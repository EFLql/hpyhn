import argparse
import json
import sys
import joblib
import torch
import numpy as np
import base64
import os
from FlagEmbedding import BGEM3FlagModel

class FeatureExtractor:
    def __init__(self):
        # 加载模型文件
        type_pca_path = os.path.join(os.path.dirname(__file__), 'type_pca.pkl')
        content_pca_path = os.path.join(os.path.dirname(__file__), 'content_pca.pkl')
        keyword_pca_path = os.path.join(os.path.dirname(__file__), 'keyword_pca.pkl')
        scaler_path = os.path.join(os.path.dirname(__file__), 'scaler.pkl')
        
        self.pca_models = {
            'type': joblib.load(type_pca_path),
            'content': joblib.load(content_pca_path),  
            'keyword': joblib.load(keyword_pca_path)
        }
        self.scaler = joblib.load(scaler_path)
        
        # 获取模型路径，优先使用环境变量
        bge_model_path = os.environ.get('BGE_M3_PATH', 'BAAI/bge-m3')
        device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
        self.emb_model = BGEM3FlagModel(bge_model_path, use_fp16=True, devices=device)
    
    def extract_numerical(self, score, comments):
        log_features = np.array([[np.log1p(score), np.log1p(comments), 0, 0]])
        return self.scaler.transform(log_features).flatten()[:2]
    
    def extract_embeddings(self, text, component):
        if not text:
            return np.zeros(64 if component != 'keyword' else 128)
        emb = self.emb_model.encode(text, batch_size=1)['dense_vecs']
        return self.pca_models[component].transform(emb.reshape(1, -1)).flatten()

class HNPostProcessor:
    def __init__(self, feature_extractor):
        self.fe = feature_extractor
        
    def process(self, score, comments, summary):
        features = [
            self.fe.extract_numerical(score, comments),
            self.fe.extract_embeddings(summary.get('articleType', ''), 'type'),
            self.fe.extract_embeddings(summary.get('contentSummary', ''), 'content'),
            self.fe.extract_embeddings(summary.get('keywords', ''), 'keyword')
        ]
        return np.concatenate(features).reshape(1, -1)

def extract_features(points, comments, summary):
    try:
        fe = FeatureExtractor()
        processor = HNPostProcessor(fe)
        features = processor.process(points, comments, summary)
        
        # 将numpy数组转换为字节数据
        features_bytes = features.astype(np.float32).tobytes()
        
        # 返回base64编码的二进制数据
        return {
            'binary': base64.b64encode(features_bytes).decode('utf-8'),
            'shape': features.shape,
            'dtype': 'float32'
        }
    except Exception as e:
        # 如果出现错误，返回错误信息
        return {
            'error': str(e)
        }

def main():
    parser = argparse.ArgumentParser(description='提取Hacker News帖子特征')
    parser.add_argument('--points', type=int, default=0, help='帖子分数')
    parser.add_argument('--comments', type=int, default=0, help='评论数')
    parser.add_argument('--summary', type=str, default='{}', help='帖子摘要（JSON格式）')
    
    args = parser.parse_args()
    
    try:
        summary_data = json.loads(args.summary)
    except json.JSONDecodeError:
        summary_data = {}
    
    # 提取特征
    features = extract_features(
        points=args.points,
        comments=args.comments,
        summary=summary_data
    )
    
    # 输出JSON格式的结果
    print(json.dumps(features))

if __name__ == '__main__':
    main()