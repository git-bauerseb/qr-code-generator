# Introduction

Welcome to my first article.


## About

QR codes are ubiquitous and can be found nearly everywhere on physical items to websites and apps. While there are many libraries that make encoding/decoding very simple, there are, is far as I know, no good tutorials that show how to write a QR code generator from scratch. This now is exactly the goal of this article: To just use some Javascript and a HTML5 canvas item to produce QR codes that you can scan and decode with your phone. So let's jump into it.


## General

First, create a new html file **qrcode.html** that looks like this:

```html
<!DOCTYPE html>
<html>
    <head></head>
    <body>
        <canvas id="qr"></canvas>
    </body>

    <script src="qr_code.js"></script>
</html>
```

and a Javascript file **qr_code.js**. The html file contains a `canvas` element where we will draw our generated code.

## Setup

Before actually coding, it's a good idea to structure our project into some classes in order to extend our implementation later if we want to. For this, I defined three classes **QRCodeUtility, QRCodeConstants, QRCodeGenerator** which later on will contain utility functions, constants used in the encoding process and an actual generator class. 

## Data Analysis

First, we need to decide what we actually want to encode:

```js
class QRCodeGenerator {

    constructor(data) {
        this.data = data;
    }
}
```

In general, the QR code specification supports four different encoding modes:

 - Numeric (Numbers 0 - 9)
 - Alphanumeric (Numbers 0 - 9; Uppercase letters; Symbols $,%,*,+,-,.,/)
    - superset of numeric mode
 - Kanji
 - Byte

In order to keep this article short, I decided to only support alphanumeric mode which means that we **cannot encode lowercase characters**. This limitation can be easily lifted but requires some boring case work so I decided to not include it.

Define the different characters that can be used in our constant class and a lookup:

```js
class QRCodeConstants {

    static Numeric = "0123456789";
    static Alphanumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
}
```

Because the numeric mode is a subset of the alphanumeric, we need a function that tells us to which mode our data string belongs to. The code for this is:

```js
// ... class QRCodeGenerator
determineMode() {
        let data = this.data;
        
        let alphanum = false;
        let numeric = true;
    
        for (let i = 0; i < data.length; i++) {
            // Check if all characters are numeric
            numeric &= QRCodeConstants.Numeric.indexOf(data[i]) >= 0;
            alphanum = QRCodeConstants.Alphanumeric.indexOf(data[i]) >= 0;

            if (!numeric) {
                break;
            }
        }
    
        return numeric ? "numeric" : "alphanum";
}
```

It just loops over all characters in our data string and checks to which class it belongs. By Anding the values in the numeric variable we make sure that we are only
in the numeric mode if all characters are numeric. Else, we immediately can tell that we will need alphanumeric mode.

## Data Encoding

After we determined the encoding mode we need to incorporate an error correction level. Depending on the use case for the generated QR code, different error correction capabilities might be necessary (physically printed QR code that might get distorted need a higher error correction level than a QR code generated on screen). The standard defines four different levels:

 - L: recover up to 7% of data
 - M: recover up to 15% of data
 - Q: recover up to 25% of data
 - H: recover up to 30% of data

Once again, as in the encoding part, I decided to only support the level L because supporting different levels lead again to some uninteresting case work. After this, we need to select which version of QR code to use. The version depends on how many characters we want to encode. There are fourty different versions, where version 1 supports up to 20 characters and version 40 supports 4296 characters.

I'm sorry to tell you once more, that the article restricts to a subset and only supports version 1. This means that with our QR code generator we can encode **up to 20 uppercase characters**. I hope not to disappoint you at this point as our generator is quite limited (we're basically restricted to uppercase english words). However, there's still some interesting stuff waiting for you.

The specification now divides our encoding in four parts:

    - Mode indicator: Indication which mode we use for encoding (numeric/alphanumeric)
    - Character count: The length of our data string
    - Data: The actual data
    - Terminator: Trailing bits to fit the entire space of available squares

### Mode Indication

For the mode indicator, simply define some constants:

```js
// ... class QRCodeConstants
    static ModeIndicator = {
        'numeric' : '0001',
        'alphanum' : '0010'
    }
```

### Character count

The character count is now a binary number that depends on the mode we use. If we use numeric mode, then it is 9 bits long (possibly padded). If we use alphanumeric mode, then it is 10 bits long (of course this is only for version 1. Other versions have different lengths).

For this define the following utility function which converts a number to a base-2 string:

```js
// ... clas QRCodeUtility
    static decimalToBinary(dec) {
        return (dec >>> 0).toString(2);
    }
```

and in `QRCodeGenerator` define a new function `getCharacterCountIndicator()`:
```js
getCharacterCountIndicator() {
    let len = this.data.length;
    let bin = QRCodeUtility.decimalToBinary(len);
    bin = bin.padStart(QRCodeConstants.CharacterCountIndicatorSize[this.mode], '0');
    return bin;
}
```

We simply compute the binary number from the length of our data string and afterwards look it up in the following hash table:

```js
// ... class QRCodeConstants
static CharacterCountIndicatorSize = {
        'numeric' : 10,
        'alphanum' : 9
};
```

### Data

After that, let's encode some data! Depending on whether we use numeric or alpha mode, we use different encoding strategies.


#### Numeric mode

In numeric enecoding, we split our data into groups of three digits, convert them to a number (100 * firstDigit + 10 * secondDigit + thirdDigit) and convert them into a binary string which has a size of 10 (so we need padding if necessary). If the length of our string is not a multiple of 3, then we are left with either groups of two or a single character. If we have two characters remaining, then we need to pad our number to a length of 7, otherwise 4 characters suffice.

This is implementented as follows:

```js
// ... class QRCodeGenerator
encodeNumeric() {
    const n = this.data.length;

    let encoded = '';

    for (let i = 0; i < n - 2; i += 3) {
        let first = QRCodeConstants.Numeric.indexOf(this.data[i]);
        let second = QRCodeConstants.Numeric.indexOf(this.data[i+1]);
        let third = QRCodeConstants.Numeric.indexOf(this.data[i+2]);
        let num =  first * 100 + second * 10 + third;
        
        let binary = QRCodeUtility.decimalToBinary(num); 

        encoded += binary.padStart(10, '0');
    }

    switch (n % 3) {
        // Nothing to do as we processed data in groups of three
        case 0: break;
        // One character remaining
        case 1: {
                let num = QRCodeConstants.Numeric.indexOf(this.data[n-1]);
                encoded += QRCodeUtility.decimalToBinary(num).padStart(4, '0');
            }
            break;
        // Two characters remaining
        case 2: {
                let first = QRCodeConstants.Numeric.indexOf(this.data[n-2]);
                let second = QRCodeConstants.Numeric.indexOf(this.data[n-1]);
                let num = first * 10 + second;
                encoded += QRCodeUtility.decimalToBinary(num).padStart(7, '0');
            }
            break;
    }

    return encoded;
}
```


#### Alphanumeric


```js
// ... class QRCodeGenerator
encodeAlpha() {
        let encoded = '';
    
        for (let i = 0; i < this.data.length - 1; i += 2) {
    
            let firstVal = QRCodeConstants.Alphanumeric.indexOf(data[i]);
            let secondVal = QRCodeConstants.Alphanumeric.indexOf(data[i + 1]);
            let binary = QRCodeUtility.decimalToBinary(firstVal * 45 + secondVal);

            encoded += binary.padStart(11, '0');
        }
    
        // If an odd number of characters are in the data
        // then append encoding of final character as 6-bit number
        if (data.length % 2 == 1) {
            encoded += QRCodeUtility.decimalToBinary(QRCodeConstants.Alphanumeric.indexOf(data[data.length - 1]))
                .padStart(6, '0');
        }
    
        return encoded;
    }
```

### Padding


## Error Correction

After a quite lengthy journey of padding and conversion from numbers to bits, we know arrived at the error correction.

For this, we need to destroy our nicely built string and chop it into bytes.

So add the following in the encode function:

```js
// ... encode() in QRCodeGenerator
// ...
let bytes = this.makeBytes(composed);
let byteStr = '';
bytes.forEach(b => {
    byteStr += b.toString(16).padStart(2, '0') + ' ';
});

console.log(byteStr);
```

and add this method:

```js
makeBytes(str) {
    let bytes = [];

    for (let i = 0; i < str.length; i += 8) {
        let substr = str.substring(i, i + 8);
        bytes.push(parseInt(substr, 2));
    }

    return bytes;
}
```

If you've done everything like I did, then you should see the string

```
20 5b 0b 78 d1 72 dc 4d 43 40 ec 11 ec 11 ec 11 ec 11 ec 
```

which are our data bits encoded and split up into bytes. Be sure, that your output string matches exactly this one as it will be crucial for a correct generation of the QR code.

#### Reed-Solomon Error Correction

When I said at the beginning that we will only need three classes, I made a little lie. In fact, we'll need a fourth class **ReedSolomonCode** that handles all the error correction stuff. I initially thought, it would be a good idea to keep everything in the **QRCodeGenerator** class but this turned into a mess. So, to keep everything nicely separated, we will add the whole error correction functionality here.

The next stop is a little discussion about finite fields. If you have a strong math background and now about galois fields and polynomials defined over them, you can safely skip this and just copy and paste the code.

##### Finite field arithmetic

When I was in school, I was taught that there are basically four number systems: Natural numbers, Integers, Rationals and Reals. As they kept defining new number systems, my abilities to express new mathematical things constantly grew. First, I could only work with positive numbers, then I was able to negate them and in the end, I could even do fancy things like sqrt(2)^2 = 2.

Now, those number systems are nice and we can do a lot with them. But they have one big downside: they are not limited and thus not really suitable 