import { retryRequest } from "@/lib/retryRequest";
import { logger } from "@/shared";

import type { APIResponse } from "@/types";

export class GetContracts {
	#baseUrl = `${process.env.OPEN_DATA_URL}/v1/contratacoes/proposta`;

	async execute({
		codigoModalidadeContratacao,
		page,
		startDateOfProposalReceiptPeriod,
		endDateOfProposalReceiptPeriod,
		uf,
	}: {
		codigoModalidadeContratacao: number;
		page: number;
		startDateOfProposalReceiptPeriod?: string;
		endDateOfProposalReceiptPeriod: string;
		uf: string;
	}): Promise<APIResponse> {
		const formatesEndDateOfProposalReceiptPeriod = this.#formatDate(
			endDateOfProposalReceiptPeriod,
		);

		let url = `${this.#baseUrl}?dataFinal=${formatesEndDateOfProposalReceiptPeriod}&uf=${uf}&codigoModalidadeContratacao=${codigoModalidadeContratacao}&pagina=${page}`;

		if (startDateOfProposalReceiptPeriod) {
			const formatesStartDateOfProposalReceiptPeriod = this.#formatDate(
				startDateOfProposalReceiptPeriod,
			);
			url = `${this.#baseUrl}?dataInicial=${formatesStartDateOfProposalReceiptPeriod}&dataFinal=${formatesEndDateOfProposalReceiptPeriod}&uf=${uf}&codigoModalidadeContratacao=${codigoModalidadeContratacao}&pagina=${page}`;
		}

		// logger.warn(url);

		const response = await retryRequest<APIResponse>(url, {
			timeoutErrorMessage: "Tempo de requisição excedido em get-contracts",
		});

		if (!response.data || !Array.isArray(response.data.data)) {
			logger.warn({
				message: "Resposta inesperada da API (data ausente ou malformado)",
				url,
				responseKeys: response.data
					? Object.keys(response.data)
					: "null/undefined",
			});
		}

		return response.data;
	}

	#formatDate(OriginalDate: string): string {
		const [year, month, day] = OriginalDate.split("-");
		return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
	}
}
