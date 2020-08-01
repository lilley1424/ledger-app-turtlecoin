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

#include "apdu_ident.h"

#include <keys.h>
#include <utils.h>

void handle_ident()
{
    /**
     * This is static non-privileged information and as thus
     * can be returned without any additional checking
     */
    sendResponse(write_io_hybrid(N_turtlecoin_wallet->magic, KEY_SIZE, APDU_IDENT_NAME, false), true);
}