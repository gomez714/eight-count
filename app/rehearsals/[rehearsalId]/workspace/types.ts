export type NoteItem = {
  id: string
  bodyText: string
  timestampMs: number
  createdAt: string | Date
  author: {
    id: string
    name: string | null
    email: string
  }
}
