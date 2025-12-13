import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import { logger } from "@/shared";

// export async function retryRequest<T = any>(
// 	config: AxiosRequestConfig,
// 	maxRetries = 5,
// 	delayMs = 5000,
// ): Promise<AxiosResponse<T>> {
// 	let attempt = 0;
// 	// biome-ignore lint/suspicious/noExplicitAny: eu quero any mesmo
// 	let lastError: any;
// 	while (attempt < maxRetries) {
// 		try {
// 			return await axios.request<T>(config);
// 			// biome-ignore lint/suspicious/noExplicitAny: eu quero any mesmo
// 		} catch (error: any) {
// 			// Se for 404, lança imediatamente (não faz retry)
// 			if (error.response && error.response.status === 404) {
// 				throw error;
// 			}
// 			lastError = error;
// 			attempt++;
// 			if (attempt < maxRetries) {
// 				logger.warn(
// 					`Request failed (attempt ${attempt} of ${maxRetries}). Retrying in ${delayMs}ms...`,
// 				);
// 				// Espera antes de tentar novamente
// 				await new Promise((resolve) => setTimeout(resolve, delayMs));
// 			}
// 		}
// 	}
// 	throw lastError;
// }

// Configura o axios-retry com delay linear crescente (removido, usando implementação custom)

// Função que recebe apenas a URL
// biome-ignore lint/suspicious/noExplicitAny: <eu quero any mesmo>
export async function retryRequest<T = any>(
	url: string,
): Promise<AxiosResponse<T>> {
	// logger.info(`Starting retryRequest for ${url}`);
	let attempt = 0;
	const maxRetries = 5;
	// biome-ignore lint/suspicious/noExplicitAny: eu quero any mesmo
	let lastError: any;
	while (attempt < maxRetries) {
		try {
			const result = await axios.get<T>(url);
			if (attempt > 0) {
				logger.warn(
					`Requisição bem sucedida na tentativa ${attempt + 1} (url: ${url})`,
				);
			}
			return result;
		} catch (error: any) {
			// Se for 404, lança imediatamente (não faz retry)
			if (error.response && error.response.status === 404) {
				throw error;
			}
			lastError = error;
			attempt++;
			if (attempt < maxRetries) {
				logger.warn(
					`Requisição falhou (tentativa ${attempt}) (url: ${url}). Retrying in ${2000 * attempt}ms...`,
				);
				// Espera antes de tentar novamente
				await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
			}
		}
	}
	throw lastError;
}
