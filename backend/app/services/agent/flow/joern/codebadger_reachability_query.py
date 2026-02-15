from __future__ import annotations

import base64
import json
from typing import Any, Dict, Optional


_REACHABILITY_QUERY_TEMPLATE = r"""
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

val maxNodesN = __MAX_NODES__

val payloadText = new String(
  java.util.Base64.getDecoder.decode("__PAYLOAD_B64__"),
  java.nio.charset.StandardCharsets.UTF_8
)
val payload = ujson.read(payloadText).obj
val file = payload.get("file").map(_.str).getOrElse("")
val line = payload.get("line").map(v => toInt(v, -1)).getOrElse(-1)
val hint = payload.get("hint").map(_.str).getOrElse("")

val blocked = collection.mutable.ArrayBuffer[String]()

val inputRegex = "(?i).*\\b(req|request|params|query|body|args|getParameter|header|cookie)\\b.*"

var callChain: List[String] = List.empty
var taintPaths: List[String] = List.empty
var pathFound = false

if (file.trim.isEmpty || line <= 0) {
  blocked.append("missing_sink_location")
} else {
  val sinkOpt = pickSinkCall(file, line, hint)
  if (sinkOpt.isEmpty) {
    blocked.append("sink_not_found")
  } else {
    val sinkCall = sinkOpt.get
    val sinkFileRel = normPath(file)
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

    val method = sinkCall.method
    val sources = (method.parameter ++ method.call.code(inputRegex))
    val flows = sinkCall.start.reachableByFlows(sources).l
    if (flows.isEmpty) {
      blocked.append("no_flow")
    } else {
      pathFound = true
      val selected = flows.sortBy(f => -f.elements.size).head
      val elements = selected.elements.take(maxNodesN)
      val nodes = elements.flatMap { e =>
        val ln = e.lineNumber.getOrElse(-1)
        if (ln <= 0) None
        else Some((relPath(firstFilename(e)), ln, e.code))
      }.toList
      val sinkFileNorm = relPath(firstFilename(sinkCall))
      val sinkLineNorm = sinkCall.lineNumber.getOrElse(-1)
      val sinkCode = sinkCall.code
      val nodesWithSink =
        if (nodes.nonEmpty && nodes.last._1 == sinkFileNorm && nodes.last._2 == sinkLineNorm && nodes.last._3 == sinkCode) nodes
        else nodes :+ (sinkFileNorm, sinkLineNorm, sinkCode)

      val compacted = nodesWithSink.foldLeft(List.empty[(String, Int, String)]) { (acc, cur) =>
        if (acc.nonEmpty && acc.last._1 == cur._1 && acc.last._2 == cur._2 && acc.last._3 == cur._3) acc
        else acc :+ cur
      }

      callChain = compacted.map { case (fp, ln, _cd) => s"${fp}:${ln}" }
      taintPaths = compacted.sliding(2).toList.flatMap {
        case List(a, b) => Some(s"${a._1}:${a._2} -> ${b._1}:${b._2}")
        case _ => None
      }
    }
  }
}

val score = if (pathFound) 0.92 else 0.12

val out = Obj(
  "path_found" -> pathFound,
  "path_score" -> score,
  "call_chain" -> Arr.from(callChain),
  "control_conditions" -> Arr(),
  "taint_paths" -> Arr.from(taintPaths),
  "entry_inferred" -> false,
  "blocked_reasons" -> Arr.from(blocked)
)

val outText = ujson.write(out)
println("<codebadger_result>" + outText + "</codebadger_result>")
outText.toString()
}
""".strip()


def build_reachability_cpgql_query(
    *,
    file_path: str,
    line_start: int,
    sink_hint: str = "",
    max_nodes: int = 80,
) -> str:
    payload = {"file": str(file_path or ""), "line": int(line_start), "hint": str(sink_hint or "")}
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    payload_b64 = base64.b64encode(payload_json.encode("utf-8")).decode("ascii")

    nodes_n = max(10, int(max_nodes))

    return _REACHABILITY_QUERY_TEMPLATE.replace("__PAYLOAD_B64__", payload_b64).replace(
        "__MAX_NODES__", str(nodes_n)
    )


def parse_codebadger_json_dict(data: Any) -> Optional[Dict[str, Any]]:
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
