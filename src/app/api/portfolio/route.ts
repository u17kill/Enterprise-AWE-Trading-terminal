import {bookRequest} from '../../../lib/portfolio-books-api';
export const runtime='nodejs';
export const GET=(request:Request)=>bookRequest(request,'sat');
export const POST=(request:Request)=>bookRequest(request,'sat');
