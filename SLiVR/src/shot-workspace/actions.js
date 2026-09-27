import { newId } from "../domain/ids.js";
import { newDiagram, diagramErrors, diagramEvidenceErrors, clone } from "./model.js";
import { flushDrafts } from "../scouting/autosave.js";

export function createShotActions({ store, repo, persist, initializeStorage, capture, navigate, openProject, now }) {
  let captureGeneration=0,openGeneration=0,queue=Promise.resolve();
  const state=()=>store.getState();
  function draft(record) {
    const bundle=state().workingBundle;
    store.setState({ shotRecord:record, ...(record.projectId && bundle?.projects[0]?.id===record.projectId ?
      { workingBundle:{...bundle,shotScenes:[...bundle.shotScenes.filter(s=>s.id!==record.id),record]} }:{}) });
  }
  async function startDiagram({ blank=false }={}) {
    const generation=++captureGeneration;
    await flushDrafts();
    if(state().save.state==="failed")return {ok:false};
    const before=state(),locationId=before.routeResolution?.locationId,route=before.route;
    store.setState({notice:blank?"Opening blank diagram…":"Capturing this map view…"});
    try{
      const background=blank?undefined:await capture();
      if(generation!==captureGeneration||state().route!==route)throw new Error("Navigation changed. Capture cancelled.");
      const location=before.catalog?.locations.find(l=>l.id===locationId);
      const record={id:newId("shotScene"),name:location?"Shot plan: "+location.name:"Untitled shot plan",
        ...(location?{locationId,catalogVersion:before.catalog.version}:{}),
        origin:{lon:location?.position[0]??0,lat:location?.position[1]??0,groundElevationM:0,elevationDatum:"Schematic image; not surveyed"},
        northOffsetDeg:0,units:"metric",calibration:{accuracyMode:"schematic"},frameVersion:1,
        createdAt:now(),updatedAt:now(),revision:1,diagram:newDiagram(background)};
      store.setState({shotReturnRoute:route,shotRecord:record,notice:null});
      navigate({name:"shot",params:{shotSceneId:record.id}});
      return {ok:true,record};
    }catch(error){store.setState({notice:error.message});return {ok:false};}
  }
  async function openDiagram(id) {
    const generation=++openGeneration,route=state().route;
    await flushDrafts();if(state().save.state==="failed")return null;
    await initializeStorage();
    const record=state().workingBundle?.shotScenes.find(s=>s.id===id)??await repo?.getShotScene?.(id);
    if(!record||generation!==openGeneration||state().route!==route)return null;
    if(record.projectId&&record.projectId!==state().openProjectId)await openProject(record.projectId);
    if(generation!==openGeneration||state().route!==route)return null;
    store.setState({shotRecord:clone(record)});
    navigate({name:"shot",params:{shotSceneId:id}});
    return record;
  }
  function updateDiagram(record,diagram,name=record.name) {
    const errors=diagramErrors(diagram);if(errors.length)throw new Error(errors[0].reason);
    const next={...record,name,diagram:clone(diagram),revision:record.revision+1,updatedAt:now()};
    draft(next);return next;
  }
  async function saveDiagram(record) {
    const saved=clone(record);
    await initializeStorage();
    if(saved.projectId&&diagramEvidenceErrors(saved,state().workingBundle??{scoutAssessmentRevisions:[]}).length)return {ok:false};
    queue=queue.catch(()=>{}).then(()=>persist(async()=>{
      const result=await repo.saveRecord("shotScenes",saved);
      if(result?.written===false)throw new Error("A newer diagram revision exists. Export this draft before reopening the saved version.");
      return result;
    }));
    return queue;
  }
  function attachDiagram(record) {
    if(record.projectId)throw new Error("This diagram already belongs to a project.");
    const s=state(),bundle=s.workingBundle,project=bundle?.projects[0];
    if(!project)throw new Error("Choose a project using the top bar first.");
    const candidate=bundle.candidates.find(c=>c.id===s.activeCandidateId&&c.locationId===record.locationId);
    const next={...record,projectId:project.id,...(s.activeSceneId?{sceneId:s.activeSceneId}:{}),
      ...(candidate?{candidateId:candidate.id,sceneId:candidate.sceneId}:{}),revision:record.revision+1,updatedAt:now()};
    draft(next);return next;
  }
  return {startDiagram,openDiagram,updateDiagram,saveDiagram,attachDiagram,
    cancelDiagramCapture(){captureGeneration++;},
    async listDiagrams(){await initializeStorage();return await repo?.listShotScenes?.()??[];},
    returnFromDiagram(){navigate(state().shotReturnRoute??(state().shotRecord?.locationId?{name:"location",params:{locationId:state().shotRecord.locationId}}:{name:"explore"}));}
  };
}
