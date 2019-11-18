var utils  = require("./utils.js");
var config = require("./config.js");

var UR = utils.UR;

var interesting_8  = config.INTERESTING_8;
var interesting_16 = interesting_8.concat(config.INTERESTING_16);
var interesting_32 = interesting_16.concat(config.INTERESTING_32);

function choose_block_len(limit) {

  var min_value;
  var max_value;
  var rlim = 3; //MIN(queue_cycle, 3);

  switch (UR(rlim)) {

    case 0:  min_value = 1;
             max_value = config.HAVOC_BLK_SMALL;
             break;

    case 1:  min_value = config.HAVOC_BLK_SMALL;
             max_value = config.HAVOC_BLK_MEDIUM;
             break;

    default: 

             if (UR(10)) {

               min_value = config.HAVOC_BLK_MEDIUM;
               max_value = config.HAVOC_BLK_LARGE;

             } else {

               min_value = config.HAVOC_BLK_LARGE;
               max_value = config.HAVOC_BLK_XL;

             }

  }

  if (min_value >= limit) min_value = 1;

  return min_value + UR(Math.min(max_value, limit) - min_value + 1);

}

exports.mutate_havoc = function (buf) { // ArrayBuffer

  var out_buf = new DataView(buf);
  var temp_len = out_buf.byteLength;

  var pos = undefined;
  var endian = true;
  var use_stacking = 1 << (1 + UR(exports.HAVOC_STACK_POW2));

  for (var i = 0; i < use_stacking; i++) {

    switch (UR(14)) {

      case 0:

        /* Flip a single bit somewhere. Spooky! */

        pos = UR(temp_len << 3);
        out_buf.setUint8(pos >> 3, out_buf.getUint8(pos >> 3) ^ (128 >> (pos & 7)));

        break;

      case 1: 

        /* Set byte to interesting value. */

        out_buf.setUint8(UR(temp_len), interesting_8[UR(interesting_8.length)]);
        break;

      case 2:

        /* Set word to interesting value, randomly choosing endian. */

        if (temp_len < 2) break;

        out_buf.setUint16(UR(temp_len - 1), interesting_16[UR(interesting_16.length >> 1)], UR(2) == 0);

        break;

      case 3:

        /* Set dword to interesting value, randomly choosing endian. */

        if (temp_len < 4) break;

        out_buf.setUint32(UR(temp_len - 3), interesting_32[UR(interesting_32.length >> 1)], UR(2) == 0);

        break;

      case 4:

        /* Randomly subtract from byte. */

        pos = UR(temp_len);
        out_buf.setUint8(pos, out_buf.getUint8(pos) - 1 - UR(config.ARITH_MAX));

        break;

      case 5:

        /* Randomly add to byte. */

        pos = UR(temp_len);
        out_buf.setUint8(pos, out_buf.getUint8(pos) + 1 + UR(config.ARITH_MAX));
        
        break;

      case 6:

        /* Randomly subtract from word, random endian. */

        if (temp_len < 2) break;

        endian = UR(2) == 0;
        pos = UR(temp_len - 1);

        out_buf.setUint16(pos, out_buf.getUint16(pos, endian) - 1 - UR(config.ARITH_MAX), endian);

        break;

      case 7:

        /* Randomly add to word, random endian. */

        if (temp_len < 2) break;
        
        endian = UR(2) == 0;
        pos = UR(temp_len - 1);

        out_buf.setUint16(pos, out_buf.getUint16(pos, endian) + 1 + UR(config.ARITH_MAX), endian);

        break;

      case 8:

        /* Randomly subtract from dword, random endian. */

        if (temp_len < 4) break;

        endian = UR(2) == 0;
        pos = UR(temp_len - 3);

        out_buf.setUint32(pos, out_buf.getUint32(pos, endian) - 1 - UR(config.ARITH_MAX), endian);

        break;

      case 9:

        /* Randomly add to dword, random endian. */

        if (temp_len < 4) break;
        
        endian = UR(2) == 0;
        pos = UR(temp_len - 3);

        out_buf.setUint32(pos, out_buf.getUint32(pos, endian) + 1 + UR(config.ARITH_MAX), endian);


        break;

      case 10:

        /* Just set a random byte to a random value. Because,
           why not. We use XOR with 1-255 to eliminate the
           possibility of a no-op. */

        pos = UR(temp_len);
        out_buf.setUint8(pos, out_buf.getUint8(pos) ^ (1 + UR(255)));

        break;

      case 11: case 12: {

          /* Delete bytes. We're making this a bit more likely
             than insertion (the next option) in hopes of keeping
             files reasonably small. */

          var del_from;
          var del_len;

          if (temp_len < 2) break;

          /* Don't delete too much. */

          del_len = choose_block_len(temp_len - 1);

          del_from = UR(temp_len - del_len + 1);

          for (var j = del_from; j < (temp_len - del_len); ++j)
            out_buf.setUint8(j, out_buf.getUint8(j + del_len));

          temp_len -= del_len;

          break;

        }

      case 13:

        if (temp_len + config.HAVOC_BLK_XL < config.MAX_FILE) {

          /* Clone bytes (75%) or insert a block of constant bytes (25%). */

          var actually_clone = UR(4);
          var clone_from;
          var clone_len;

          if (actually_clone) {

            clone_len  = choose_block_len(temp_len);
            clone_from = UR(temp_len - clone_len + 1);

          } else {

            clone_len = choose_block_len(config.HAVOC_BLK_XL);
            clone_from = 0;

          }

          var clone_to = UR(temp_len);

          buf = new ArrayBuffer(temp_len + clone_len);
          var new_buf = new DataView(buf);

          /* Head */

          for (var j = 0; j < clone_to; ++j)
            new_buf.setUint8(j, out_buf.getUint8(j));

          /* Inserted part */

          if (actually_clone)
            for (var j = 0; j < clone_len; ++j)
              new_buf.setUint8(clone_to + j, out_buf.getUint8(clone_from + j));
          else
            for (var j = 0; j < clone_len; ++j)
              new_buf.setUint8(clone_to + j, UR(2) ? UR(256) : out_buf.getUint8(UR(temp_len)));

          /* Tail */
          for (var j = clone_to; j < temp_len; ++j)
            new_buf.setUint8(j + clone_len, out_buf.getUint8(j));

          out_buf = new_buf;
          temp_len += clone_len;

        }

        break;

      case 14: {

          /* Overwrite bytes with a randomly selected chunk (75%) or fixed
             bytes (25%). */

          var copy_from;
          var copy_to;
          var copy_len;

          if (temp_len < 2) break;

          copy_len  = choose_block_len(temp_len - 1);

          copy_from = UR(temp_len - copy_len + 1);
          copy_to   = UR(temp_len - copy_len + 1);

          if (UR(4)) {

            if (copy_from != copy_to) {
            
              var sl = new Uint8Array(buf.slice(copy_from, copy_from + copy_len));
              for (var j = 0; j < copy_len; ++j)
                out_buf.setUint8(copy_to + j, sl[j]);
                
            }
              

          } else {
          
            var b = UR(2) ? UR(256) : out_buf.getUint8(UR(temp_len));
            for (var j = 0; j < copy_len; ++j)
              out_buf.setUint8(copy_to + j, b);

          }

          break;

        }
        
        default: break;

    }

  }
  
  if (temp_len != buf.length)
    return buf.slice(0, temp_len);
  return buf;

}

