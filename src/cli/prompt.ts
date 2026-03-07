import inquirer, { type QuestionCollection } from "inquirer";
import { ContractingModalityCode, type PromptAnswers } from "@/types";

const convertToISO = (dateBr: string) => {
	const [day, month, year] = dateBr.split("-");
	return `${year}-${month}-${day}`;
};

const isLeapYear = (year: number): boolean => {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

const isValidDayOfMonth = (day: number, month: number): boolean => {
	if (month === 2) {
		return day >= 1 && day <= 29; // Considera até 29 para permitir validação de ano bissexto posteriormente
	} else if ([4, 6, 9, 11].includes(month)) {
		return day >= 1 && day <= 30;
	} else {
		return day >= 1 && day <= 31;
	}
};

const questions: QuestionCollection<PromptAnswers> = [
	{
		type: "list",
		name: "codigoModalidadeContratacao",
		message: "Escolha a modalidade de contratação:",
		choices: Object.entries(ContractingModalityCode)
			.filter(([key]) => Number.isNaN(Number(key))) // Filter out numeric keys from enum
			.map(([key, value]) => ({ name: key, value: value })),
		default: ContractingModalityCode["Dispensa de Licitação"],
	},
	{
		type: "input",
		name: "dataPublicacaoPncp",
		message:
			"Digite a data de publicação no PNCP (DD-MM-YYYY) para filtrar (Opcional, deixe em branco para não filtrar):",
		validate: (input: string) => {
			if (!input) return true;
			const match = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
			if (!match) {
				return "Por favor, digite uma data válida no formato DD-MM-YYYY ou deixe em branco para não filtrar.";
			}
			const [_, day, month, year] = match;
			const dayNum = Number.parseInt(day, 10);
			const monthNum = Number.parseInt(month, 10);
			const yearNum = Number.parseInt(year, 10);
			if (!isValidDayOfMonth(dayNum, monthNum)) {
				return "Data inválida (dia inválido para o mês).";
			}
			if (monthNum === 2 && dayNum === 29 && !isLeapYear(yearNum)) {
				return "Data inválida (29-02 em ano não bissexto).";
			}
			return true;
		},
	},
	{
		type: "input",
		name: "startDateOfProposalReceiptPeriod",
		message:
			"Digite a data de INÍCIO do período de recebimento de propostas (DD-MM-YYYY):",
		validate: (input: string) => {
			const match = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
			if (!match) {
				return "Por favor, digite uma data válida no formato DD-MM-YYYY.";
			}
			const [_, day, month, year] = match;
			const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
			if (
				date.getUTCFullYear() === Number.parseInt(year, 10) &&
				date.getUTCMonth() + 1 === Number.parseInt(month, 10) &&
				date.getUTCDate() === Number.parseInt(day, 10)
			) {
				const today = new Date();
				today.setUTCHours(0, 0, 0, 0);
				if (date < today) {
					return "A data inicial não pode ser menor que a data atual.";
				}
				return true;
			}
			return "Data inválida (ex: 29/02 em ano não bissexto).";
		},
		default: (() => {
			const now = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
			const dia = now.getDate().toString().padStart(2, "0");
			const mes = (now.getMonth() + 1).toString().padStart(2, "0");
			const ano = now.getFullYear();
			return `${dia}-${mes}-${ano}`;
		})(),
	},
	{
		type: "input",
		name: "endDateOfProposalReceiptPeriod",
		message:
			"Digite a data de FIM do período de recebimento de propostas (DD-MM-YYYY):",
		validate: (input: string, answers: PromptAnswers) => {
			const match = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
			if (!match) {
				return "Por favor, digite uma data válida no formato DD-MM-YYYY.";
			}
			const [_, day, month, year] = match;
			const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
			if (
				date.getUTCFullYear() === Number.parseInt(year, 10) &&
				date.getUTCMonth() + 1 === Number.parseInt(month, 10) &&
				date.getUTCDate() === Number.parseInt(day, 10)
			) {
				const today = new Date();
				today.setUTCHours(0, 0, 0, 0);
				if (date < today) {
					return "A data final não pode ser menor que a data atual.";
				}
				const [startDay, startMonth, startYear] =
					answers.startDateOfProposalReceiptPeriod.split("-");
				const startDate = new Date(
					`${startYear}-${startMonth}-${startDay}T12:00:00Z`,
				);
				if (date < startDate) {
					return "A data final não pode ser menor que a data inicial.";
				}
				return true;
			}
			return "Data inválida.";
		},
		default: () => {
			return "31-12-2050";
		},
	},
	{
		type: "input",
		name: "folderToStorage",
		message: "Pasta para armazenamento dos itens:",
		default: "_itens",
	},
	{
		type: "number",
		name: "timeDelay",
		message: "Delay entre requisições (ms):",
		default: 100,
	},
	{
		type: "number",
		name: "paginaInicial",
		message: "Página inicial:",
		default: 1,
	},
	{
		type: "input",
		name: "uf",
		message: "UF (Opcional, padrão SP):",
		default: "SP",
	},
];

/**
 * Solicita ao usuário as configurações básicas para a consulta.
 */
export async function promptUser(): Promise<PromptAnswers> {
	const answers: PromptAnswers = await inquirer.prompt(questions);

	return {
		codigoModalidadeContratacao: answers.codigoModalidadeContratacao,
		startDateOfProposalReceiptPeriod: convertToISO(
			answers.startDateOfProposalReceiptPeriod,
		),
		endDateOfProposalReceiptPeriod: convertToISO(
			answers.endDateOfProposalReceiptPeriod,
		),
		folderToStorage: answers.folderToStorage,
		timeDelay: answers.timeDelay,
		paginaInicial: answers.paginaInicial,
		uf: answers.uf,
		dataPublicacaoPncp: answers.dataPublicacaoPncp
			? convertToISO(answers.dataPublicacaoPncp)
			: undefined,
	};
}
