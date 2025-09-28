import dotenv from "dotenv";
import { exec } from "child_process";
import puppeteer from "puppeteer-core";

dotenv.config();

const routerIp = process.env.ROUTER_IP;
const routerPassword = process.env.ROUTER_PASSWORD;

if (!routerIp || !routerPassword) {
    console.error("❌ Please set ROUTER_IP and ROUTER_PASSWORD in the .env file.");
    process.exit(1);
}

function checkInternetConnectivity() {
    return new Promise((resolve) => {
        // gunakan ping sesuai OS
        const isWin = process.platform === "win32";
        const cmd = isWin ? "ping -n 1 8.8.8.8" : "ping -c 1 8.8.8.8";

        exec(cmd, (error) => {
            resolve(!error);
        });
    });
}

async function reconnectToNetwork() {
    try {
        const browser = await puppeteer.launch({
            headless: false,
            executablePath:
                process.platform === "win32"
                ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
                : "/usr/bin/chromium-browser",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.goto(`http://${routerIp}`, { waitUntil: "networkidle0" });

        // tunggu field password siap
        await page.waitForSelector('input[id="login_password"]', { visible: true });
        await page.type('input[id="login_password"]', routerPassword);

        await Promise.all([
            page.click('div[id="login_btn"]'),
            page.waitForNavigation({ waitUntil: "networkidle0" }),
        ]);

        await page.goto(`http://${routerIp}/html/content.html#mobileconnection`, {
            waitUntil: "networkidle0",
        });

        // wait for the switch to appear
        await page.waitForSelector('div[id="apn_mobile_network_switch"]', { visible: true });

        // check switch status
        const status = await page.$eval('#apn_mobile_network_switch', el => el.classList.contains('switch_on'));

        if (status) {
            console.log("🔄 Switch is ON, toggling OFF then back ON...");
            await page.click('div[id="apn_mobile_network_switch"]');

            // wait until it changes to OFF
            await page.waitForFunction(() => {
                const el = document.getElementById("apn_mobile_network_switch");
                return el && el.className.includes("switch_off");
            });

            // click again to turn ON
            await page.click('div[id="apn_mobile_network_switch"]');
            await page.waitForFunction(() => {
                const el = document.getElementById("apn_mobile_network_switch");
                return el && el.className.includes("switch_on");
            });
        } else {
            console.log("🔄 Switch is OFF, turning ON...");
            await page.click('div[id="apn_mobile_network_switch"]');

            await page.waitForFunction(() => {
                const el = document.getElementById("apn_mobile_network_switch");
                return el && el.className.includes("switch_on");
            });
        }

        await new Promise(resolve => setTimeout(resolve, 10000)); // wait 10 seconds to ensure connection stabilizes
        await browser.close();
        console.log("✅ Reconnected successfully!");
    } catch (err) {
        console.error("❌ Failed to reconnect:", err.message);
    }
}

async function monitorConnection() {
  const checkInterval = 10000; // 10 seconds
    while (true) {
        const isConnected = await checkInternetConnectivity();
        if (!isConnected) {
            console.log("⚠️ No internet connection. Attempting to reconnect...");
            await reconnectToNetwork();
        } else {
            console.log("✅ Internet OK");
        }
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
}

monitorConnection();
