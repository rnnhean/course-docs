[00:00] hello and welcome on this lecture we will start at caching for get all posts endpoint alright just ignore this and that and that and come up here for get all posts okay we can start from this part here
[00:28] And stored by create cache key Cache key Or, I don't know if you can hear, yeah, cache key Can be fmt sprintf
[00:55] We can call this post user %s page %d and stored by past the user ID.
[01:23] as well as the page okay next I just stored by say cached data an error database ready as client
[01:51] next we need to check if error equal equal to new on that case cache head so we can store by defining variable cached
[02:19] response or res, models, cached all posts, response, then check if error where this gson, unmartial, slice of byte,
[02:47] of this cached data and we are looking for f this error is equal equal to 0
[03:14] ok we need to armor shell this or something and that something will be pointer of this cache res we just fix this
[03:39] all right next we can just say if the error is equal equal to 1 on that case we can return something similar to what we have here just copy that go to the top
[04:06] paste that here okay I just stored by the posts will be cached rest dot data current page will be cached rest
[04:35] current page number of pages will be cached response number of pages and we can add here cached true I think that's useful we can also add it down here
[05:03] and just say cached false all right now we need to come up here before we need to say what else and just log printf
[05:33] error cached data passed the error all right
[05:57] so this is mean that cache is missing then we need to move done and here we need to prepare cache response
[06:25] let's just say response molecule to models cache get all posts response data will be posts current page will be page number of pages
[06:50] All going to equal to the same thing here. All right, I just put that here. All right, next we can just start caching the response for 10 seconds.
[07:20] Ok, I can just say response json Error, this one goes too, json Marshall
[07:49] this response. Then check if the error is equal to 0. On that case we can just say database, radius, client, set, the CTX, hash key, response, JSON, 10 times time.
[08:17] second oops really what is that we need to add here comma second all right we're good we're cool we're good everything is okay I just rerun our application all the time okay
[08:45] Go to the front-end, specifically. I think home. Okay, let's just go to the store. Okay, posts. Get posts. Can just come up here, save console.
[09:13] .log check post caching as this data it save alright everything is running cached nil ok just refresh check post caching as you can see it gives true
[09:42] go up here for profile for example and go back now caching is false if we refresh as you can see caching is true so this data returns to us via what it called I forgot sorry we are ready to see
[10:11] Okay, they just start by, for example, open this, okay. This is cached, it's true. What if I like this and refresh the page? It gives me the time like this. What if I unlike this and refresh the page? Okay, unlike this, despite the fact that I like...
[10:40] the post it still give me that this is light why because this is already cached after I hit unlike after 10 seconds if I refresh it will give me this is a light and caching is false and this is the point behind all of this is using caching for actually not use MongoDB for everything for
[11:10] for application performance on a big scale with big number of users and I think that's pretty it now what we can do is to come up here so you get a tool we need to commit the changes we can just
[11:39] Just write down anything. I have some authentication issue with my github. Just write this one more time. Now I want to open the application.
[12:09] the github on our gray hero or hero all now we want to push this in new and branch name upgrade right I think now we can have compare and make
[12:35] I think we need of course torque on the CICD pipeline as well as updating
[13:02] some of our DevOps since that we don't have multiple services on our backend right now. So let's just start work on that on the next lecture.
[13:16] Thank you.
