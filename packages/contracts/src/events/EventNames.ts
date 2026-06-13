export const EventNames = {
  GuildRegistered: 'guild.registered',
  ProfileCreated: 'profile.created',
  WalletCreated: 'wallet.created',
  TicketOpened: 'ticket.opened',
  TicketClosed: 'ticket.closed'
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];
