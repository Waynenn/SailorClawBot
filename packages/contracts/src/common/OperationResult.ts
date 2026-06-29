export interface OperationResult<T = void> {
	success: boolean;
	data?: T;
	error?: string;
}
