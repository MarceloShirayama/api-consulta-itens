export class BaseError extends Error {
	name: string;
	message: string;
	cause?: { message: string; field: string };

	constructor({
		message,
		cause,
	}: { message: string; cause?: { message: string; field: string } }) {
		super(message);
		this.message = message;
		this.name = `${this.constructor.name}-${Object.getPrototypeOf(this.constructor.prototype).constructor.name}`;
		this.cause = cause;
	}
}
