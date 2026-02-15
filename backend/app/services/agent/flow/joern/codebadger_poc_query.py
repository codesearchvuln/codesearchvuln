from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any, Dict, Optional


_EXT_LANGUAGE_MAP: dict[str, str] = {
    # Smart audit policy: Joern is only used for Java / C / C++.
    ".java": "java",
    # C
    ".c": "c",
    ".h": "c",
    # C++
    ".cc": "cpp",
    ".cpp": "cpp",
    ".cxx": "cpp",
    ".hh": "cpp",
    ".hpp": "cpp",
    ".hxx": "cpp",
}


def infer_codebadger_language(file_path: str) -> Optional[str]:
    suffix = Path(str(file_path or "")).suffix.lower()
    if not suffix:
        return None
    return _EXT_LANGUAGE_MAP.get(suffix)


_POC_TRIGGER_CHAIN_BATCH_QUERY_TEMPLATE = r"""
{
import io.shiftleft.codepropertygraph.generated.nodes.StoredNode
import io.shiftleft.semanticcpg.language._
import io.joern.dataflowengineoss.language._
import io.joern.dataflowengineoss.queryengine._
import ujson._

implicit val context: EngineContext = EngineContext()

private def normPath(value: String): String = {
  if (value == null) return ""
  value.replace("\\", "/").trim
}

private def firstFilename(node: StoredNode): String = {
  try node.location.filename
  catch { case _: Throwable => "" }
}

private def toInt(value: Value, fallback: Int): Int = {
  try value.num.toInt
  catch { case _: Throwable =>
    try value.str.trim.toInt
    catch { case _: Throwable => fallback }
  }
}

private def pickSinkCall(
  sinkFile: String,
  sinkLine: Int,
  sinkHint: String
): Option[Call] = {
  val fileNorm = normPath(sinkFile)
  val candidates = cpg.call.l
    .filter(c => c.lineNumber.contains(sinkLine))
    .filter(c => normPath(firstFilename(c)).endsWith(fileNorm))

  if (candidates.isEmpty) return None
  if (sinkHint != null && sinkHint.trim.nonEmpty) {
    candidates.find(_.code.contains(sinkHint.trim)).orElse(candidates.headOption)
  } else {
    candidates.headOption
  }
}

private def pickEntryMethod(entryFile: String, entryFunc: String): Option[Method] = {
  val fileNorm = normPath(entryFile)
  val funcNorm = (if (entryFunc == null) "" else entryFunc).trim
  if (fileNorm.isEmpty || funcNorm.isEmpty) return None
  cpg.method.name(funcNorm).l.filter(m => normPath(firstFilename(m)).endsWith(fileNorm)).headOption
}

private def nodeObj(idx: Int, filePath: String, line: Int, code: String): Obj = {
  Obj(
    "index" -> idx,
    "file_path" -> normPath(filePath),
    "line" -> line,
    // function/context will be filled by backend for better multi-language support
    "function" -> "",
    "code" -> (if (code == null) "" else code.take(400))
  )
}

val maxFlowsN = __MAX_FLOWS__
val maxNodesN = __MAX_NODES__

val payloadText = new String(
  java.util.Base64.getDecoder.decode("__PAYLOAD_B64__"),
  java.nio.charset.StandardCharsets.UTF_8
)
val payload = ujson.read(payloadText)
val items = payload.obj.get("items").map(_.arr.toSeq).getOrElse(Seq.empty)

val results = collection.mutable.LinkedHashMap[String, Value]()
val errors = collection.mutable.LinkedHashMap[String, Value]()

val inputRegex = "(?i).*\\b(req|request|params|query|body|args|getParameter|header|cookie)\\b.*"

items.foreach { item =>
  val obj = item.obj
  val key = obj.get("key").map(_.str).getOrElse("").trim
  if (key.isEmpty) {
    // skip invalid item
  } else {
    try {
      val sinkFile = obj.get("sink_file").map(_.str).getOrElse("")
      val sinkLine = obj.get("sink_line").map(v => toInt(v, -1)).getOrElse(-1)
      val sinkHint = obj.get("sink_hint").map(_.str).getOrElse("")
      val entryFile = obj.get("entry_file").map(_.str).getOrElse("")
      val entryFunc = obj.get("entry_func").map(_.str).getOrElse("")

      if (sinkFile.trim.isEmpty || sinkLine <= 0) {
        errors.put(key, Str("missing_sink_location"))
      } else {
        val sinkCallOpt = pickSinkCall(sinkFile, sinkLine, sinkHint)
        if (sinkCallOpt.isEmpty) {
          errors.put(key, Str("sink_not_found"))
        } else {
          val sinkCall = sinkCallOpt.get
          val sinkFileRel = normPath(sinkFile)
          val sinkFileAbs = normPath(firstFilename(sinkCall))
          val rootPrefix =
            if (sinkFileRel.nonEmpty && sinkFileAbs.endsWith(sinkFileRel)) sinkFileAbs.substring(0, sinkFileAbs.length - sinkFileRel.length)
            else ""

          def relPath(abs: String): String = {
            val a = normPath(abs)
            if (rootPrefix.nonEmpty && a.startsWith(rootPrefix)) {
              val rel0 = a.substring(rootPrefix.length)
              if (rel0.startsWith("/")) rel0.substring(1) else rel0
            } else {
              a
            }
          }

          val methodOpt = pickEntryMethod(entryFile, entryFunc).orElse(Option(sinkCall.method))
          if (methodOpt.isEmpty) {
            errors.put(key, Str("enclosing_method_not_found"))
          } else {
            val method = methodOpt.get
            val sources = (method.parameter ++ method.call.code(inputRegex))

            val flows = sinkCall.start.reachableByFlows(sources).l
            if (flows.isEmpty) {
              errors.put(key, Str("no_flow"))
            } else {
              val selected = flows.sortBy(f => -f.elements.size).take(maxFlowsN).headOption
              if (selected.isEmpty) {
                errors.put(key, Str("no_selected_flow"))
              } else {
                val elements = selected.get.elements.take(maxNodesN)

                val rawNodes = elements.flatMap { e =>
                  val line = e.lineNumber.getOrElse(-1)
                  if (line <= 0) None
                  else Some((relPath(firstFilename(e)), line, e.code))
                }.toList

                val sinkFileNorm = relPath(firstFilename(sinkCall))
                val sinkLineNorm = sinkCall.lineNumber.getOrElse(-1)
                val sinkCode = sinkCall.code
                val nodesWithSink =
                  if (rawNodes.nonEmpty && rawNodes.last._1 == sinkFileNorm && rawNodes.last._2 == sinkLineNorm && rawNodes.last._3 == sinkCode) rawNodes
                  else rawNodes :+ (sinkFileNorm, sinkLineNorm, sinkCode)

                val compacted = nodesWithSink.foldLeft(List.empty[(String, Int, String)]) { (acc, cur) =>
                  if (acc.nonEmpty && acc.last._1 == cur._1 && acc.last._2 == cur._2 && acc.last._3 == cur._3) acc
                  else acc :+ cur
                }

                if (compacted.size < 2) {
                  errors.put(key, Str("flow_too_short"))
                } else {
                  val nodeValues = compacted.zipWithIndex.map { case ((fp, ln, cd), idx) =>
                    nodeObj(idx, fp, ln, cd)
                  }

                  val sourceNode = nodeValues.head.obj
                  val sinkNode = nodeValues.last.obj

                  val chain = Obj(
                    "version" -> 1,
                    "engine" -> "joern_dataflow",
                    "source" -> Obj(
                      "file_path" -> sourceNode("file_path"),
                      "line" -> sourceNode("line"),
                      "function" -> sourceNode("function"),
                      "code" -> sourceNode("code")
                    ),
                    "sink" -> Obj(
                      "file_path" -> sinkNode("file_path"),
                      "line" -> sinkNode("line"),
                      "function" -> sinkNode("function"),
                      "code" -> sinkNode("code")
                    ),
                    "nodes" -> Arr.from(nodeValues),
                    "generated_at" -> java.time.Instant.now().toString
                  )
                  results.put(key, chain)
                }
              }
            }
          }
        }
      }
    } catch {
      case e: Throwable =>
        errors.put(key, Str("exception:" + e.getClass.getSimpleName))
    }
  }
}

val out = Obj(
  "version" -> 1,
  "engine" -> "joern_dataflow",
  "results" -> Obj.from(results),
  "errors" -> Obj.from(errors)
)

val outText = ujson.write(out)
println("<codebadger_result>" + outText + "</codebadger_result>")
outText.toString()
}
""".strip()


def build_poc_trigger_chain_batch_cpgql_query(
    *,
    items: list[dict[str, Any]],
    max_flows: int,
    max_nodes: int,
) -> str:
    payload = {"items": items or []}
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    payload_b64 = base64.b64encode(payload_json.encode("utf-8")).decode("ascii")

    flows_n = max(1, int(max_flows))
    nodes_n = max(10, int(max_nodes))

    return (
        _POC_TRIGGER_CHAIN_BATCH_QUERY_TEMPLATE.replace("__PAYLOAD_B64__", payload_b64)
        .replace("__MAX_FLOWS__", str(flows_n))
        .replace("__MAX_NODES__", str(nodes_n))
    )


def parse_codebadger_query_data(data: Any) -> Optional[Dict[str, Any]]:
    if isinstance(data, dict):
        return data

    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            return first
        if isinstance(first, str):
            try:
                parsed = json.loads(first)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                return None

    if isinstance(data, str):
        try:
            parsed = json.loads(data)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return None

    return None
