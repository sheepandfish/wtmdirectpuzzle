import "./style.css";
import { Game } from "./game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const hud = document.getElementById("hud-root") as HTMLElement;
new Game(canvas, hud);
