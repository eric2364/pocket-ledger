export function summaryFormError(configured:boolean,password:string,confirm:string):string|null{
 if(!password)return 'Enter your Summary password.';
 if(!configured&&password!==confirm)return 'The passwords do not match. Check the confirmation password.';
 return null;
}
