import { Request } from 'express';
import { SafeUser } from '../../users/user.types';

export interface AuthenticatedRequest extends Request {
  user: SafeUser;
}
