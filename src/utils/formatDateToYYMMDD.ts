import { logger } from "@/shared";

export function formatDateToYYMMDD(dateStr: string) {
	try {
		const [day, month, year] = dateStr.split("-");
		if (year && month && day) {
			return `${year.slice(2)}-${month}-${day}`;
		}
		// return "Arquivo com data inválida";
		throw new Error("Data inválida");
		// biome-ignore lint/suspicious/noExplicitAny: <eu quero any mesmo>
	} catch (error: any) {
		logger.error(`Erro ao formatar data: ${dateStr} - ${error}`, error.stack);
		return "data-invalida";
	}
}
