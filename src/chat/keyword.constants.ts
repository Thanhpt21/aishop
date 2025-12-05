// keyword.constants.ts (đặt cùng thư mục hoặc nơi phù hợp)
export const KeywordConstants = {
  followUpKeywords: [
    'nó', 'cái này', 'sản phẩm này', 'áo này', 'quần này',
    'cái đó', 'thế còn', 'còn', 'thế', 'vậy',
    'giá', 'chất liệu', 'size', 'màu', 'có không',
    'như thế nào', 'ra sao', 'được không', 'thì sao'
  ],
  productKeywords: [
    'áo', 'quần', 'váy', 'đầm', 'giày', 'dép', 'túi', 'ví',
    'thun', 'sơmi', 'khoác', 'hoodie', 'jean', 'tây', 'short',
    'jogger', 'polo', 'tanktop', 'vest', 'len', 
    'vớ', 'tất', 'dây', 'tay', 'cổ', 'mũ', 'nón', 'khăn', 'đồng hồ',
    'giặc', 'tăng', 'gối', 'nệm', 'gương', 'bàn chải', 'găng tay'
  ],
  questionWords: [
    'gì', 'nào', 'sao', 'thế nào', 'ra sao', 'tư vấn'
  ],
  stopWords: new Set([
    'có', 'và', 'là', 'của', 'cho', 'với', 'như', 'từ', 'được',
    'một', 'các', 'hay', 'hoặc', 'nếu', 'thì', 'mà', 'ở', 'trong',
    'bạn', 'tôi', 'shop', 'bán', 'mua', 'nào', 'gì', 'ạ', 'vậy',
  ]),
};
