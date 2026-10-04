/* Swap MODEL_SOURCE to a custom Teachable Machine/model adapter when training your own classifier. */
export const MODEL_SOURCE = 'mobilenet';
export const CONFIDENCE_THRESHOLD = 0.60;
let modelPromise;

export async function loadModel(){
  if(MODEL_SOURCE !== 'mobilenet') return null;
  if(!modelPromise) modelPromise = (async()=>{ if(!window.mobilenet) return null; try { return await window.mobilenet.load({version:2, alpha:1.0}); } catch { return null; } })();
  return modelPromise;
}

export async function classifyImage(image){
  const model = await loadModel();
  if(model){ try { const predictions = await model.classify(image, 3); if(predictions?.length) return predictions[0]; } catch { /* fallback below */ } }
  return { className:'everyday object', probability:0.52, fallback:true };
}
