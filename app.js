import dotenv from "dotenv"
import { exec } from "child_process"
import puppeteer from "puppeteer-core"

dotenv.config()

const routerIp = process.env.ROUTER_IP
