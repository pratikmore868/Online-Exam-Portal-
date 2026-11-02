// Copies the face and phone detection engine into public/ so the app serves it itself,
// and students' browsers don't need to reach a third party during an exam. Runs after npm install.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const source = "node_modules/@mediapipe/tasks-vision/wasm";
if (existsSync(source)) {
  mkdirSync("public/mediapipe", { recursive: true });
  cpSync(source, "public/mediapipe/wasm", { recursive: true });
}
