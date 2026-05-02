export type User = {
  _id: string
  username: string
  phoneNumber?: string
  countryCode?: string
  about?: string
}

export type MessageReply = {
  _id: string
  sender: User
  content: string
  timestamp?: string
  attachment?: {
    url: string
    type: 'image' | 'video' | 'audio' | 'document'
    name?: string
    size?: number
    mimeType?: string
  }
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
  replyTo?: MessageReply | null
  attachment?: {
    url: string
    type: 'image' | 'video' | 'audio' | 'document'
    name?: string
    size?: number
    mimeType?: string
  }
}
