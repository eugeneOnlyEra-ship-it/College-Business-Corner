import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatTurnDto {
  @ApiProperty({ enum: ['user', 'model'] })
  role: 'user' | 'model';

  @ApiProperty()
  text: string;
}

export class AgentChatDto {
  @ApiProperty({
    example: 'I need 40 pages printed and a haircut, budget $25.',
    description: 'What the student wants, in plain language.',
  })
  message: string;

  @ApiPropertyOptional({ type: [ChatTurnDto], description: 'Earlier turns of this conversation (text only).' })
  history?: ChatTurnDto[];
}
