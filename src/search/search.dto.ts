import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export class SearchQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(20)
  limit = 20;
}
