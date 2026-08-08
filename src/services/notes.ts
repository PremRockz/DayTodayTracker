import { BaseRecord } from './localStore';

export interface NoteRecord extends BaseRecord {
  title: string;
  content: string;
  isFavorite: boolean;
}
