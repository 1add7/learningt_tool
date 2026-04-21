import mongoose, { Schema, Document } from 'mongoose';

export interface IKnowledgeNode extends Document {
  question: string;
  answer: string;
  context?: string; // Selected text from parent answer
  parentId?: mongoose.Types.ObjectId;
  sessionId: string;
  createdAt: Date;
  children?: IKnowledgeNode[]; // Virtual for population
}

const KnowledgeNodeSchema: Schema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  context: { type: String, default: null },
  parentId: { type: Schema.Types.ObjectId, ref: 'KnowledgeNode', default: null },
  sessionId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

// Virtual populate for children
KnowledgeNodeSchema.virtual('children', {
  ref: 'KnowledgeNode',
  localField: '_id',
  foreignField: 'parentId'
});

// Enable virtuals in JSON
KnowledgeNodeSchema.set('toJSON', { virtuals: true });
KnowledgeNodeSchema.set('toObject', { virtuals: true });

export default mongoose.model<IKnowledgeNode>('KnowledgeNode', KnowledgeNodeSchema);
