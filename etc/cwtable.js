// 展開
/*
function (h,b) {
	// 文字幅テーブル
	var _ = {};
	for (var i=0, x, t=0,l=0, v, u=0, s=String.fromCharCode;
		x = b.charCodeAt(i++); ) { // 一文字ずつ
		x = x&64 ?
		    x&32 ? x-71 : x-65 :
		    x&16 ? x+4  : x>>2|62; // 6 ビットに変換
		for (var j=5; j>=0; j--) { // 1 ビットずつ
			t = t<<1 | x>>j&1; var g=h[l++]; // 符号を足す
			if (t in g) { // ハフマンテーブルにあれば
				t=g[t]; // 値を取得
				if (v) // PackBits
					if (v<0) { // 不連続
						if(t) _[s(u)]=t;
						u++, v++;
					} else { // 連続
						if(t) while(v--) _[s(u++)]=t;
						else u+=v;
						v=0;
					}
				else v = t<0 ? t-1 : t+1;
				t=l=0;
			}
		}
	}
}
*/
(function ($) {
	
	function read(element) {
		var str = '';
		for (var node = element.firstChild; node; ) {
			switch (node.nodeType) {
				case 1: str += read(node); break;
				case 3: str += node.data;  break;
			}
			node = node.nextSibling;
		}
		return str;
	}
	
	function packbits(array) {
		var length = array.length;
		if (length == 0) return [];
		
		var packed = [], buffer = [];
		var count = 0; var copy = true;
		
		var prev = array[0];
		for (var i = 1; i < length; i++) {
			var value = array[i];
			if (value === prev) {
				if (copy) {
					if (buffer.length) {
						packed.push(1 - buffer.length);
						packed = packed.concat(buffer);
						buffer.length = 0;
					}
					copy = false;
				}
				count++;
			} else {
				if (copy) buffer.push(prev);
				else {
					packed.push(count, prev);
					count = 0; copy = true;
				}
				prev = value;
			}
		}
		
		if (copy) {
			buffer.push(prev);
			packed.push(1 - buffer.length);
			packed = packed.concat(buffer);
		}
		else packed.push(count, prev);
		
		return packed;
	}
	
	function Item(index, value) {
		this.index = index;
		this.value = value;
	}
	function stableSort(array, compare) {
		var i, l = array.length; var a = [];
		for (i = 0; i < l; i++) {
			a[i] = new Item(i, array[i]);
		}
		a.sort(function (a, b) {
			return compare(a.value, b.value) || a.index - b.index;
		});
		for (i = 0; i < l; i++) {
			array[i] = a[i].value;
		}
		return array;
	}
	
	function Node(left, right) {
		this.left  = left;
		this.right = right;
	}
	function Leaf(value) {
		this.value = value;
	}
	
	function Count(node, count) {
		this.node = node;
		this.count = count;
	}
	function compare(a, b) {
		return a.count - b.count;
	}
	
	function Code(value, number, length) {
		this.value = value;
		this.number = number;
		this.length = length;
	}
	
	function counts(data) {
		var counts = [], indexes = {};
		var l = data.length;
		for (var i = 0; i < l; i++) {
			var v = data[i];
			if (v in indexes) {
				counts[indexes[v]].count++;
			} else {
				indexes[v] = counts.push(
					new Count(new Leaf(v), 1) ) - 1;
			}
		}
		return counts;
	}
	function tree(counts) {
		while (counts.length > 1) {
			stableSort(counts, compare);
			var a = counts.shift();
			var b = counts.shift();
			counts.push(new Count(
				new Node(a.node, b.node),
				a.count + b.count));
		}
		return counts[0].node;
	}
	function codes(tree, out, num, len) {
		if (tree instanceof Leaf) {
			out.push(new Code(tree.value, num, len));
		} else {
			codes(tree.left,  out, num << 1 | 0, len + 1);
			codes(tree.right, out, num << 1 | 1, len + 1);
		}
		return out;
	}
	
	var chars = (function () {
		var i;
		var upper = 'A'; var u = upper.charCodeAt();
		var lower = 'a'; var l = lower.charCodeAt();
		for (i = 1; i < 26; i++) {
			upper += String.fromCharCode(u + i);
			lower += String.fromCharCode(l + i);
		}
		var chars = upper + lower;
		for (i = 0; i < 10; i++) chars += i;
		return chars + '+/';
	})();
	
	function Codes() {
		this.strs = [];
	}
	var prototype = Codes.prototype;
	
	prototype.push = function (code) {
		this.strs.push(code.number + ':' + code.value);
		this[code.number] = true;
	};
	prototype.toString = function () {
		return '{' + this.strs + '}';
	};
	
	function padding(table, length, i, number) {
		if (number in table[i]) return null;
		if (++i == length) {
			return new Code(0, number, length);
		}
		number <<= 1;
		return padding(table, length, i, number | 0) ||
		       padding(table, length, i, number | 1);
	}
	
	function huffman(data) {
		var out = codes(tree(counts(data)), [], 0, 0);
		var i, l; var code;
		
		var dic = {}, table = [];
		for (i = 0, l = out.length; i < l; i++) {
			code = out[i];
			dic[code.value] = code;
			
			var cl = code.length - 1;
			if (!(cl in table)) table[cl] = new Codes();
			table[cl].push(code);
		}
		for (i = -1, l = table.length; i < l; i++) {
			if (!(i in table)) table[i] = new Codes();
		}
		
		var base64 = '';
		var bs = 0, bl = 0;
		for (i = 0, l = data.length; i < l; i++) {
			code = dic[data[i]];
			
			bs = bs << code.length | code.number;
			bl += code.length;
			while (bl >= 6) {
				bl -= 6;
				base64 += chars.charAt(bs >> bl & 63);
			}
		}
		if (bl) {
			code = padding(table, 6 - bl, -1, 0);
			bs = bs << code.length | code.number;
			base64 += chars.charAt(bs & 63);
		}
		
		return [
			'[' + table  + ']',
			"'" + base64 + "'"
		];
	}
	
	window.onload = function () {
		var span = $.getElementById('span');
		var text = span.firstChild;
		
		var frame = $.getElementById('frame');
		var doc = frame.contentWindow.document;
		
		var widths = []; var i, l;
		var chars = read(doc).split(' ');
		
		for (i = 0, l = chars.length - 1; i < l; i++) {
			var u = parseInt(chars[i], 16);
			// if (u >= 0x0300 && u <= 0x036F) continue; // 結合文字
			if (u == 0x2028 || u == 0x2029) continue; // LS, PS
			if (u >= 0x4E00 && u <= 0x9FFF) continue; // 統合漢字
			
			text.data = String.fromCharCode(u);
			widths[u] = span.offsetWidth; // ＭＳ Ｐゴシックの文字幅は整数
		}
		
		// 修正
		// widths[0x20] = 5;
		// for (i = 0x4E00; i <= 0x9FFF; i++) widths[i] = 16;
		
		// 0 埋め
		for (i = 0, l = widths.length; i < l; i++) {
			if (!(i in widths)) widths[i] = 0;
		}
		
		text.data = huffman(packbits(widths)).toString();
	};
})(document);
