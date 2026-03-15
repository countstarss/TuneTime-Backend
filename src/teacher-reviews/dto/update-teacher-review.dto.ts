import { PartialType } from '@nestjs/swagger';
import { CreateTeacherReviewDto } from './create-teacher-review.dto';

export class UpdateTeacherReviewDto extends PartialType(CreateTeacherReviewDto) {}
