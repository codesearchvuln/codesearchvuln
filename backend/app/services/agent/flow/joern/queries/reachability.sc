// Joern reachability verifier (source -> sink) for a single finding.
//
// Params:
//   project: absolute project root
//   file: finding file path (relative to project root, normalized)
//   line: finding line number
//   hint: optional code snippet hint (best-effort)
//   maxNodes: number, default 80
//
// Output (printed between markers; caller should extract and parse JSON):
//   {
//     "path_found": bool,
//     "path_score": number,
//     "call_chain": string[],
//     "control_conditions": string[],
//     "taint_paths": string[],
//     "entry_inferred": bool,
//     "blocked_reasons": string[]
//   }
//
// Notes:
// - Best-effort: when no dataflow path is found, we return structured blocked reasons.

import io.joern.console.*
import io.shiftleft.semanticcpg.language.*
import io.shiftleft.codepropertygraph.generated.nodes.StoredNode
import io.joern.dataflowengineoss.language.*
import io.joern.dataflowengineoss.queryengine.*
import ujson.*

private val JSON_START = "<<<JOERN_REACHABILITY_JSON_START>>>"
private val JSON_END = "<<<JOERN_REACHABILITY_JSON_END>>>"

private def normPath(value: String): String = {
  if (value == null) return ""
  value.replace("\\", "/").trim
}

private def firstFilename(node: StoredNode): String = {
  try node.location.filename
  catch { case _: Throwable => "" }
}

private def pickSinkCall(sinkFile: String, sinkLine: Int, sinkHint: String): Option[Call] = {
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

@main def main(
  project: String,
  file: String,
  line: String,
  hint: String = "",
  maxNodes: String = "80"
): Unit = {
  val runName = "reach_" + java.util.UUID.randomUUID().toString.replace("-", "")
  importCode(project, runName)

  implicit val context: EngineContext = EngineContext()

  val ln = try line.toInt catch { case _: Throwable => -1 }
  val maxNodesN = try maxNodes.toInt catch { case _: Throwable => 80 }

  val blocked = collection.mutable.ArrayBuffer[String]()
  val inputRegex = "(?i).*\\b(req|request|params|query|body|args|getParameter|header|cookie)\\b.*"

  var callChain: List[String] = List.empty
  var taintPaths: List[String] = List.empty
  var pathFound = false

  if (file == null || file.trim.isEmpty || ln <= 0) {
    blocked.append("missing_sink_location")
  } else {
    val sinkOpt = pickSinkCall(file, ln, hint)
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
          val lno = e.lineNumber.getOrElse(-1)
          if (lno <= 0) None
          else Some((relPath(firstFilename(e)), lno, e.code))
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

        callChain = compacted.map { case (fp, lno, _cd) => s"${fp}:${lno}" }
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

  println(JSON_START)
  println(ujson.write(out))
  println(JSON_END)
}
