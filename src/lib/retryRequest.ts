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

// Configura o axios-retry com delay exponencial
axiosRetry(axios, {
	retries: 5,
	retryDelay: axiosRetry.exponentialDelay,
	retryCondition: (error) => {
		// Não faz retry para 404
		return error.response?.status !== 404;
	},
	onRetry: (retryCount, _error, _requestConfig) => {
		logger.warn(`Request failed (attempt ${retryCount}). Retrying...`);
		logger.warn(
			`Error details: ${_error.message} - Status: ${_error.response?.status}`,
		);
	},
});

// Função que recebe apenas a URL
// biome-ignore lint/suspicious/noExplicitAny: <eu quero any mesmo>
export async function retryRequest<T = any>(
	url: string,
): Promise<AxiosResponse<T>> {
	return axios.get<T>(url);
}
