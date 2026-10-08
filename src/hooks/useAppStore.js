import { useEffect, useState } from "react";
import { bootDatabase, call } from "../data/database";
const blank = {
  workspaces: [],
  scriptCategories: [],
  categories: [],
  assets: [],
  groups: [],
  prompts: [],
  innerCanvasObjects: [],
  innerCanvasViewports: [],
  innerCanvasAppearances: [],
  assetTextElements: [],
  assetTextLayouts: [],
  categoryTextBlocks: [],
  customFonts: [],
  settings: null,
  shortcutBindings: [],
  cacheBytes: 0,
  databasePath: "",
};
export function useStore() {
  const [data, setData] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bootAttempt, setBootAttempt] = useState(0);
  const reload = async () => {
    try {
      setData(await call("load_app_state"));
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    bootDatabase()
      .then(value => {if(active)setData(value)})
      .catch((e) => {if(active)setError(String(e))})
      .finally(() => {if(active)setLoading(false)});
    return () => {active = false};
  }, [bootAttempt]);
  const run = async (command, args) => {
    try {
      const result = await call(command, args);
      call("diagnostic_log", {event:`${command}:ok`}).catch(()=>{});
      await reload();
      return result;
    } catch (e) {
      call("diagnostic_log", {event:`${command}:error`}).catch(()=>{});
      setError(String(e));
      throw e;
    }
  };
  return {
    data,
    setData,
    loading,
    error,
    clearError: () => setError(""),
    reportError: setError,
    run,
    reload,
    retryBoot: () => setBootAttempt(value => value + 1),
  };
}
