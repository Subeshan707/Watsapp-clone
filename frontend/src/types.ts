export type User = {
  _id: string
  username: string
  phoneNumber?: string
  countryCode?: string
  about?: string
}

export type Message = {
  _id: string
  sender: User
  receiver: User
  content: string
  timestamp: string
  deliveredAt?: string | null
  readAt?: string | null
  editedAt?: string | null
}
