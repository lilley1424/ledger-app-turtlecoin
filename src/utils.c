/*******************************************************************************
 *   Ledger Blue
 *   (c) 2016 Ledger
 *   (c) 2020 The TurtleCoin Developers
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ********************************************************************************/

#include "utils.h"

uint32_t readUint32BE(uint8_t *buffer)
{
    return (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | (buffer[3]);
}

uint16_t readUint16BE(uint8_t *buffer)
{
    BEGIN_TRY
    {
        TRY
        {
            uint16_t value = (buffer[0] << 8) | (buffer[1]);

            CLOSE_TRY;

            return value;
        }
        CATCH_OTHER(e)
        {
            return 0;
        }
        FINALLY {}
    }
    END_TRY;
}

void uint16ToChar(unsigned char *r, const uint16_t value)
{
    unsigned char lo = value & 0xFF;

    unsigned char hi = value >> 8;

    r[0] = hi;

    r[1] = lo;
}

void sendResponse(size_t tx, bool approve)
{
    G_io_apdu_buffer[tx++] = approve ? 0x90 : 0x69;

    G_io_apdu_buffer[tx++] = approve ? 0x00 : 0x85;

    // Send back the response, do not restart the event loop
    io_exchange(CHANNEL_APDU | IO_RETURN_AFTER_TX, tx);

    // Display back the original UX
    ui_idle();
}

void sendError(const uint16_t errCode)
{
    unsigned char _errCode[2];

    uint16ToChar(_errCode, errCode);

    sendResponse(write_io_hybrid(_errCode, sizeof(_errCode), ERR_STR, true), false);
}

void do_deny()
{
    explicit_bzero(WORKING_SET, WORKING_SET_SIZE);

    sendError(ERR_OP_NOT_PERMITTED);
}

unsigned int ui_prepro(const bagl_element_t *element)
{
    unsigned int display = 1;

    if (element->component.userid > 0)
    {
        display = (ux_step == element->component.userid - 1);

        if (display)
        {
            if (element->component.userid == 1)
            {
                UX_CALLBACK_SET_INTERVAL(2000);
            }
            else
            {
                UX_CALLBACK_SET_INTERVAL(MAX(3000, 1000 + bagl_label_roundtrip_duration_ms(element, 7)));
            }
        }
    }

    return display;
}

size_t write_io(const unsigned char *output, const unsigned char *name, bool hexData)
{
    const unsigned int output_size = ptrLength(output);

    const unsigned int name_size = ptrLength(name);

    return write_io_fixed(output, output_size, name, name_size, hexData);
}

size_t write_io_hybrid(
    const unsigned char *output,
    const unsigned int output_size,
    const unsigned char *name,
    bool hexData)
{
    const unsigned int name_size = ptrLength(name);

    return write_io_fixed(output, output_size, name, name_size, hexData);
}

size_t write_io_fixed(
    const unsigned char *output,
    const unsigned int output_size,
    const unsigned char *name,
    const unsigned int name_size,
    bool hexData)
{
    PRINTF("%.*s: ", name_size, name);

    if (hexData)
    {
        PRINTF("%.*H ", output_size, output);
    }
    else
    {
        PRINTF("%.*s ", output_size, output);
    }

    PRINTF(" -> SIZE: %u\n", output_size);

    size_t tx = 0;

    os_memmove(G_io_apdu_buffer + tx, output, output_size);

    tx += output_size;

    return tx;
}

void toHexString(const unsigned char *in, const unsigned int in_len, unsigned char *out, const unsigned int out_len)
{
    unsigned int i, pos = 0;

    for (i = 0; i < in_len; i++)
    {
        SPRINTF((char *)out + pos, "%02x", in[i]);

        pos += 2;
    }

    out[out_len] = '\0';
}