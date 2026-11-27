import { brand } from "./brand.ts"
import { startExperience } from "./engine/director.ts"
import { scenes } from "./scenes.ts"
import "./styles.css"

startExperience(brand, scenes)
