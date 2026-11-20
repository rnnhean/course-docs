[00:00] hello and welcome on this lecture we will start to update or upgrade or get user by id endpoint or controller limit as you want as a matter of fact this function here that same function that we used for user profile if you remember this give us the user data and as you can see here it returns the user posts now we are not only have
[00:29] the have to return user post with the commands not just that we need actually to return the user posts vaginately meaning when you open the user profile you can find a specific amount of posts when you move down or when you scroll down it should give you more posts
[00:58] just like we had with the normal page like home page etc. Alright, first of all we need to start from here from this description and things related to Swagger to allow us to check this or test it by ourselves. Anyway, before we move to different NLK
[01:27] what we need to add here is a param for page and this actually should be query so I just came up here and say page this is the name of the param or parameter it is not on pass it is a query
[01:55] next it is actually an integer false it is not required so we need to just false okay next we need to come up here and start as we already understand how this works
[02:24] only to come up here and say this is a piece on M all right this will be used to capture the aggregation results all right next below this and this yeah below this part
[02:51] All we need to do is to add the object ID. I don't think I need this anymore, only just to come up here and say page.
[03:20] ok I think we need to take this nearly all this out for now and then just go back to this port of the code for page we need to say as I said is dr180
[03:49] i c.curry page and we need to just pass default value if it not exist all right let's call next next we need to set the limit
[04:19] Do we have the limit open already or not? No, I just create it for limit. Okay, I just give it just 3. Okay, next we need to get the data first for the user.
[04:47] they have this already or not just copy this paste not here alright
[05:15] we have this user result it is 4 of your ID okay next we need to come up down this uncheck f user result as in your if this no icode or nil on that case we can return anything
[05:45] okay we can just come up here say bad gateway or not found I think all right
[06:15] and we can just say message user not found and we can just say success false
[06:40] all right then I need to come up here and add a filter our filter will be for the creator this will be used for getting the user creator this will be using to getting the user posts of JID
[07:09] okay next we need to get the total number of the posts get total of user posts okay we just start by define a variable and error this one goes to post schema documents
[07:38] cdx and pass our filter check if error not equal to 0 that case we need to return something like that let's just copy it and paste it here we just head save to re-organize this and we can just pass a message no posts
[08:06] all right and now we need to have an aggregation for aggregation pipeline for post this with comments and user data okay I suggest to go back where are we to any of these pipelines this loop
[08:35] clock so complicated just search for another one this one looks good and you can simply update this so i just came up here say aggregation
[09:02] for posts, web, comments, and user. All right, let me just paste that here and start work on that. First of all, the first matching that we are looking for is creator. Creator, yep.
[09:31] and here we are looking for new object ID alright next we need to have kind of sorting so sort based on M we can use ID or create it at hyphen on okay
[10:00] let's go next we need to have the skip okay and hit 64 page half and on this multiplied width limit
[10:28] next we need to add the limit so we can use limit operator for this just n64 and pass our limit variable
[10:58] right below this we have this symbol look up yes we start by say from command and then have this let post ID
[11:23] Give it this variable, right? I don't know, I have D pipeline. Nearly every Seng is the same from users. So, user ID, expression, interface, 4uid, project, name.
[11:52] on and image URL as user yep that's everything we need to have on this one project id on value on connected to add user id user on yeah that's it
[12:17] I just now go to the project, check it one by one, first we need to have the id, the creator, the title, the message, the name, selected files, likes, created ad comments, yep, that's exactly how we need to have. Just go back, maybe we can have the same thing here.
[12:47] copy this going back now paste that here check it on by one all right we need first to fix this to be post aggregation or aggregate sorry all right
[13:12] we pass the adjuster have it by this way ok ok fair, aggregation failed, aggregation more, we can just came up here say posts, aggregation failed
[13:39] so we start by call this aggregation then we defer and close this courser all right let's go next we call courser I think we need to move this down
[14:07] okay and here instead of have results we can just say posts okay after that we can just directly check for posts
[14:33] if this is equal equal to 0 ok all we can do is do something totally different let's just change this and say posts or equal make pass on M amp has 0 alright
[15:02] and after all we can just return something like the old response but we do need to just update it a little bit okay we need to return the user
[15:32] we need to return the posts and also we need to return column page will be this page and the number of pages
[15:57] mass we know already how to calculate this sail float sorry float 64 total divided on just make this video is on this float
[16:26] 64 of this limit all right all right that's cool I think that's all we need to do now I just hit save I need to rebuild this so I need to clear it first then rebuild it all right this already generated now I just run the app to test dot
[16:56] okay we have we have users of course we will check for this user we have posts we have only two posts and I very fresh I'm not sure that we need to log in or not anyway get user by ID
[17:25] it does need to have a authentication just page one yep execute great look like that this works fine it return posts ID commands likes documents here is empty for this post hello second
[17:51] but here it is not empty for this post just go down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down down
[18:20] name so we need to fix that and I think we need to go up and check yeah the number of edges to the bridge okay this this is cool where are we where this user just go up up up up up up up up up up up up up up
[18:49] yeah i think we need just to decode this so we can just say user result decode pointer of this user hit save earlier on this one more time okay now we'll just go back hit this once more
[19:17] okay, go down, alright, following on floor, some biohano, okay, like that, everything works fine. Sure, you can just test this by yourself, but it is obviously, it works fine for me and also go on to test it when we start to move back to the front end.
[19:42] then now everything looks great to me on the next lecture we will finally work on the last part on this back end update upgrade which is related to the notification
[20:00] so we just move on to the next lecture and start work on that.
