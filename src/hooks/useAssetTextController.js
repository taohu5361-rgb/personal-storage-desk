import { useEffect, useRef, useState } from 'react';
import { call } from '../data/database';
import { createAssetTextController } from '../data/assetTextController.js';
import { syncFontFaces } from '../components/text/fontFaces';

export function useAssetTextController(assetId, store) {
  const source = () => ({elements:store.data.assetTextElements.filter(e=>e.assetId===assetId),layouts:store.data.assetTextLayouts.filter(l=>l.assetId===assetId)});
  const [snapshot,setSnapshot] = useState(source);
  const controllerRef = useRef(null);
  if (!controllerRef.current || controllerRef.current.assetId !== assetId) {
    const controller = createAssetTextController(assetId,source(),(viewMode,changes)=>call('save_asset_text_changes',{assetId,viewMode,changes}),setSnapshot);
    controller.assetId=assetId;controllerRef.current=controller;
  }
  const controller = controllerRef.current;
  useEffect(()=>controller.refresh(source()),[controller,store.data.assetTextElements,store.data.assetTextLayouts]);
  useEffect(()=>syncFontFaces(store.data.customFonts),[store.data.customFonts]);
  return {controller,...snapshot};
}
