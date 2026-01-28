import axios, { type AxiosResponse } from "axios";
import { logger } from "@/shared";

// Função que recebe apenas a URL
// biome-ignore lint/suspicious/noExplicitAny: <eu quero any mesmo>
export async function retryRequest<T = any>(
	url: string,
): Promise<AxiosResponse<T>> {
	let attempt = 0;
	const maxRetries = 5;
	// biome-ignore lint/suspicious/noExplicitAny: eu quero any mesmo
	let lastError: any;
	while (attempt < maxRetries) {
		try {
			logger.notice(`Iniciando requisição: ${url}`);
			const result = await axios.get<T>(url, { timeout: 30000 });
			if (attempt > 0) {
				logger.warn(
					`Requisição bem sucedida na tentativa ${attempt + 1} (url: ${url})`,
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
				logger.warn(
					`Requisição falhou (tentativa ${attempt}) (url: ${url}). Motivo: ${error.message}. Retrying in ${2000 * attempt}ms...`,
				);
				// Espera antes de tentar novamente
				await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
			}
		}
	}
	throw lastError;
}
