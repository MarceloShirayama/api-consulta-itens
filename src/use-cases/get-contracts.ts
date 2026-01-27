import { retryRequest } from "@/lib/retryRequest";

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

		const response = await retryRequest(url);
		return response.data as APIResponse;
	}

	#formatDate(OriginalDate: string): string {
		const partes = OriginalDate.split("-");
		const day = Number.parseInt(partes[0]);
		const month = Number.parseInt(partes[1]);
		const year = Number.parseInt(partes[2]);

		const formattedDate = `${year}${month.toString().padStart(2, "0")}${day.toString().padStart(2, "0")}`;
		return formattedDate;
	}
}
