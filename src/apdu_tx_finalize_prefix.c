/*****************************************************************************
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
 *****************************************************************************/

#include "apdu_tx_finalize_prefix.h"

#include <transaction.h>
#include <utils.h>

static void do_tx_finalize_prefix()
{
    BEGIN_TRY
    {
        TRY
        {
            const int status = tx_finalize_prefix();

            if (status != OP_OK)
            {
                THROW(status);
            }

            CLOSE_TRY;

            sendResponse(0, true);
        }
        CATCH_OTHER(e)
        {
            sendError(e);
        }
        FINALLY {}
    }
    END_TRY;
}

UX_STEP_SPLASH(
    ux_tx_finalize_prefix_1_step,
    pnn,
    do_tx_finalize_prefix(),
    {&C_icon_turtlecoin, "Finalizing", "Tx Prefix..."});

UX_FLOW(ux_tx_finalize_prefix_flow, &ux_tx_finalize_prefix_1_step);

void handle_tx_finalize_prefix(volatile unsigned int *flags)
{
    if (tx_state() != TX_OUTPUTS_RECEIVED)
    {
        return sendError(ERR_TRANSACTION_STATE);
    }

    ux_flow_init(0, ux_tx_finalize_prefix_flow, NULL);

    *flags |= IO_ASYNCH_REPLY;
}