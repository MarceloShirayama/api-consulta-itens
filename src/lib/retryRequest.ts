import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { logger } from "@/shared";

// Função que recebe apenas a URL
// biome-ignore lint/suspicious/noExplicitAny: <eu quero any mesmo>
export async function retryRequest<T = any>(
	url: string,
	config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
	let attempt = 0;
	const maxRetries = 10;
	const timeout = 30000;
	const totalStartTime = Date.now();
	// biome-ignore lint/suspicious/noExplicitAny: eu quero any mesmo
	let lastError: any;
	while (attempt < maxRetries) {
		const requestStartTime = Date.now();
		try {
			logger.notice(`Iniciando requisição: ${url}`);
			const result = await axios.get<T>(url, { timeout, ...config });
			if (attempt > 0) {
				const totalDuration = Date.now() - totalStartTime;
				logger.warn(
					`Requisição bem sucedida na tentativa ${attempt + 1} (url: ${url}) em ${totalDuration}ms`,
				);
			}
			return result;
			// biome-ignore lint/suspicious/noExplicitAny: <é any mesmo>
		} catch (error: any) {
			// Se for 404, lança imediatamente (não faz retry)
			if (error.response && error.response.status === 404) {
				throw error;
			}
			lastError = error;
			attempt++;
			if (attempt < maxRetries) {
				const requestDuration = Date.now() - requestStartTime;
				const awaitTime = 2000 * attempt;
				const totalElapsed = Date.now() - totalStartTime;

				logger.warn(
					`Requisição falhou em ${requestDuration}ms (tentativa ${attempt}) (url: ${url}). Total decorrido: ${totalElapsed}ms. Motivo: ${error.message}. Retrying in ${awaitTime}ms...`,
				);
				// Espera antes de tentar novamente
				await new Promise((resolve) => setTimeout(resolve, awaitTime));
			}
		}
	}
	throw lastError;
}
