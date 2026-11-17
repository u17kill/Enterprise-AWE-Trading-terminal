import {bookRequest} from '../../../lib/portfolio-books-api';
export const runtime='nodejs';
export const GET=(request:Request)=>bookRequest(request,'core');
export const POST=(request:Request)=>bookRequest(request,'core');
