import sys
import json
try:
    from PyPDF2 import PdfReader
    PDF_LIB_AVAILABLE = True
except ImportError:
    PDF_LIB_AVAILABLE = False
    print("Error: PyPDF2 not available")

def extract_text_from_pdf(file_path):
    if not PDF_LIB_AVAILABLE:
        return "Error: PyPDF2 library not available"
        
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PdfReader(file)
            text = ""
            
            total_pages = len(pdf_reader.pages)
            
            # 确定要处理的页面范围
            # 前10页
            front_pages = min(10, total_pages)
            
            # 后10页
            back_pages_start = max(front_pages, total_pages - 10)
            
            # 提取前10页
            for page_num in range(front_pages):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n"
            
            # 如果总页数大于20，添加分隔符
            if total_pages > 20:
                text += "\n... (中间页面省略) ...\n\n"
            
            # 提取后10页（避免重复提取）
            if back_pages_start < total_pages:
                for page_num in range(back_pages_start, total_pages):
                    page = pdf_reader.pages[page_num]
                    text += page.extract_text() + "\n"
            
            return text
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python parse_pdf.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = extract_text_from_pdf(file_path)
    print(json.dumps({"result": result}))