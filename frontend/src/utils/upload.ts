import { Platform } from "react-native";
import { fetch as expoFetch } from "expo/fetch";

/** Multipart form for a local file (image/audio/document) that works on web and on real phones. */
export async function uploadForm(uri: string, field = "file", name = "upload.jpg") {
  const form = new FormData();
  const blob = Platform.OS === "web" ? await (await fetch(uri)).blob() : await (await expoFetch(uri)).blob();
  form.append(field, blob as any, name);
  return form;
}
