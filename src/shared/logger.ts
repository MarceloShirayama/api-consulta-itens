import fs from "node:fs";
import path from "node:path";

const rootPath = process.cwd();
const logsPath = path.join(rootPath, "_logs");
const errorsLogFilePath = path.join(logsPath, "errors.log");

const escapeSequence = "\x1b";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const reset = "\x1b[0m";
const blue = "\x1b[34m";

export const logger = {
	error: (message: string, error: unknown) => {
		let logMessage: string;
		if (!error) {
			return;
		}
		if (error instanceof Error) {
			logMessage = `${red}[ERROR] ${new Date().toISOString()} - ${message} - ${error.message} - ${error.stack}${reset}\n`;
		} else {
			logMessage = `[ERROR] ${new Date().toISOString()} - ${message} - ${JSON.stringify(error, null, 2)}\n`;
		}
		console.error(logMessage);

		const logDir = path.dirname(errorsLogFilePath);
		if (!fs.existsSync(logDir)) {
			fs.mkdirSync(logDir, { recursive: true });
		}
		if (!fs.existsSync(errorsLogFilePath)) {
			fs.writeFileSync(errorsLogFilePath, "");
		}
		fs.appendFileSync(
			errorsLogFilePath,
			`\n${logMessage.replace(new RegExp(`${escapeSequence}\\[([0-?]*[ -/]*[@-~])`, "g"), "")}`,
		);
	},
	info: (message: unknown) => {
		const logMessage = `${green}[INFO] ${new Date().toISOString()} - ${JSON.stringify(message, null, 2)}${reset}\n`;
		console.info(logMessage);
	},
	warn: (message: unknown) => {
		const logMessage = `${yellow}[WARN] ${new Date().toISOString()} - ${JSON.stringify(message, null, 2)}${reset}\n`;
		console.warn(logMessage);
	},
	notice: (message: unknown) => {
		const logMessage = `${blue}[NOTICE] ${new Date().toISOString()} - ${JSON.stringify(message, null, 2)}${reset}\n`;
		console.log(logMessage);
	},
};
