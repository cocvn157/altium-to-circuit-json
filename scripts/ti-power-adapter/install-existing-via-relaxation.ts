import { AutoroutingPipelineSolver } from "@tscircuit/capacity-autorouter"

// Diagnostic configuration of existing stages; no input geometry changes.
export function installExistingViaRelaxation(): void {
  const prototype = AutoroutingPipelineSolver.prototype
  const original = prototype.step
  const configured = new WeakSet<object>()
  Object.defineProperty(prototype, "step", { value: function(this:any,...args:unknown[]) {
    if (!configured.has(this)) {
      const stage=this.pipelineDef.find((step:any)=>step.solverName==="globalDrcForceImproveSolver")
      if(!stage)throw new Error("Missing existing global clearance repair stage")
      const getParams=stage.getConstructorParams
      stage.getConstructorParams=(pipeline:any)=>{
        const [parameters]=getParams(pipeline)
        if(parameters.enablePostSolveClearanceRelaxation!==false)throw new Error("Unexpected clearance repair configuration")
        return [{...parameters,enablePostSolveClearanceRelaxation:true,srj:{...parameters.srj,minViaEdgeToPadEdgeClearance:Math.max(parameters.srj.minViaEdgeToPadEdgeClearance??0,parameters.srj.minPadEdgeToPadEdgeClearance??0)}}]
      }
      configured.add(this)
    }
    return Reflect.apply(original,this,args)
  }})
}
