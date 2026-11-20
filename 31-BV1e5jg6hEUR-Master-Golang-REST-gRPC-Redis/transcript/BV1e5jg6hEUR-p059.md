[00:00] hi and welcome back my dear student on this lecture as I said on the last lecture from this lecture we will start work a little bit on our back-end site okay and the main idea here that we won't talk it on it is actually related all of it related to the posts as you already know
[00:26] here we just have this symbol array of strings here that include the posts, the comments for user posts and this is actually not proper way to doing this so what I need to have is to comment the user who had this comment
[00:53] we do need to have the user data and the comment value we want to be able to allow our users to edit or I believe it is enough to allow our user to delete the comment or the post creator if he doesn't like the comment etc. anyway if you need to add edit won't be a problem but the idea here dot or
[01:22] our database is not relational so we will have a new table just a new collection sorry just for the comments include this data and we will face another problem which is getting the post comments since that each post will include many comments I assume that it includes many comments so
[01:51] This might be a problem with the initial code so first of all Adjust the store by create this model for the comment. We can call a current model All right, I just store by define the package models
[02:17] import time I think we need to import primitive as well okay I'll just restore by define our first type I just call this comment struct
[02:46] and first thing we need to add is the ID which will be primitive object ID alright this will be json sorry json of just underscore ID
[03:11] optimity okay and the person can be nearly the same omit empty
[03:39] All right. Okay, it looks like that we have an error. I think we need to add a column here. Yup. Remove that space, not necessary, okay.
[04:02] also we need to have many primitive many objects ids just to 140 post itself so post id i just change this to be post id alright also
[04:31] this one will be for the user id so the user will add this comment user id cool after that what we need to have is the value itself of the comment string json
[05:00] value and for this one value okay finally we cannot create it out nope capital C created out time
[05:28] not time all right for the json just have created that as well as for PSON
[05:53] Okay, like that we got an error. Yep, we forget again to add the column. I think that's all. Maybe we need to have this created comment. We just see. If we have something like that, we just copy this from here. Is that here?
[06:22] just name this create comment okay we have here a typo just fix it okay comment all right that's cool now we just go back to the posts
[06:46] and we need actually to update this this is very obvious the first thing here we need to update the sync is the creator this one should be primitive yep primitive objectoidy objectoidy okay we can keep the JSON on this one with the same name
[07:15] title shall look like created that so we need here to come on the comments
[07:43] and I think it is good to have another tool be an array of steng which is include nearly everything so we can just change this to be comment so this will be array of comment
[08:08] i don't think actually that this will fit for the requirements since that we need to add the user data as well so just change this to be comment for the user comment wet user okay this empty empty
[08:38] we need to add it here all right next down here we need to start create this type command node user struct
[09:02] I think we can grab all this from here now go back leave all this here id post id user id value created add but finally we need to add the user model yep
[09:31] which can be simply just a user person user all right and down here we can just say that the user will be pointer of user model okay
[09:59] this can be just dash okay
[10:28] or else we need i think we duplicating this one here and here we just take this out for now whatever i need or we can leave it maybe we can use it if we mess or forget the name i don't think that we need it anyway
[10:55] so everything else is the same now depending on all of this I think that we need to start go to the social I'll start remove this post just drop the conduction
[11:24] all right we have users notification messages okay let's go all right from the next lecture we will start working on creating posts we need to update that also work on the rest
[11:53] because this one torque code you in same way and work on the rest of the handler or controller methods so I just move on to the next lecture and work on that
[12:11] Thank you.
