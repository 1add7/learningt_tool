import mongoose, { Schema, Document } from 'mongoose';

export interface ICitation {
  nodeId: string;
  question: string;
  score: number;
  mode: string;
}

export interface IKnowledgeNode extends Document {
  question: string;
  answer: string;
  context?: string; // Selected text from parent answer
  parentId?: mongoose.Types.ObjectId;
  sessionId: string;
  createdAt: Date;
  children?: IKnowledgeNode[]; // Virtual for population
  embedding?: number[]; // 语义检索用的向量表示
  embeddingModel?: string; // 生成该向量的模型名，便于后续换模型时重建
  embeddedAt?: Date;
  citations?: ICitation[]; // 该回答引用到的历史节点
}

const CitationSchema = new Schema(
  {
    nodeId: { type: String, required: true },
    question: { type: String, default: '' },
    score: { type: Number, default: 0 },
    mode: { type: String, default: 'vector' },
  },
  { _id: false },
);

const KnowledgeNodeSchema: Schema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  context: { type: String, default: null },
  parentId: { type: Schema.Types.ObjectId, ref: 'KnowledgeNode', default: null },
  sessionId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  // default: undefined 避免未建索引的节点被写入空数组
  embedding: { type: [Number], default: undefined },
  embeddingModel: { type: String, default: null },
  embeddedAt: { type: Date, default: null },
  citations: { type: [CitationSchema], default: [] },
});

// Virtual populate for children
KnowledgeNodeSchema.virtual('children', {
  ref: 'KnowledgeNode',
  localField: '_id',
  foreignField: 'parentId'
});

// Enable virtuals in JSON
// 注意：向量有 1024 维，绝不能下发给前端（单节点会撑到几 KB），这里统一剥离
KnowledgeNodeSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    delete ret.embedding;
    return ret;
  },
});
KnowledgeNodeSchema.set('toObject', { virtuals: true });

export default mongoose.model<IKnowledgeNode>('KnowledgeNode', KnowledgeNodeSchema);
