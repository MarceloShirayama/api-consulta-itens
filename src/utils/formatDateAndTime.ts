export function formatDateAndTime(date: Date) {
	const dateFormatted = date.toISOString().slice(0, 10).replace(/-/g, "");
	const timeFormatted = date
		.toLocaleTimeString("pt-BR", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
		.replace(/:/g, "");

	return `date${dateFormatted}-hour${timeFormatted}`;
}
