[00:00] Hello and welcome. On this lecture, we will start adding Redis for caching on our application. Specifically, you will add Redis for caching on just two endpoints for getUser profile and getAllPosts. You can apply this as many as you want, but I will just add this for
[00:26] I'll just add redis or caching for these two endpoints. First of all, on backend I don't think that we still need this real-time chat and real-time notification anymore, so we can get rid of them. Next, I'll just start by creating a connection specifically for redis.
[00:50] So inside the database we just create this file and we just start by defining a variable that includes that redis client so we can use it globally So a pointer of redis
[01:19] Ok, not client. We don't need to have this, ok. Next we need to have a function to initialize the database, so just call it in it.
[01:46] Right, we just stored by say RedisClient. This would equal Redis.NewClient. Here we needed to add a pointer of Redis.
[02:16] options okay and before I move on I prefer to go to the backend API I just open up the terminal here
[02:45] and then say go mod.id all right now let's just go back start by add the address which come get from the os sorry sorry sorry os get nv
[03:09] We can call this Redis URL. Next password which can also get from OS and get Env Redis password.
[03:35] right db can use 0 also you can add pulling size we just make it 10 and the main id is to connect
[04:03] main idle cons idle cons we just give it five protocol two okay we just let save and here we can just test the connection and we can just say cdx
[04:33] Cancel. So it goes to contacts. I time out. Sorry, contacts. I time out. Contacts background. Five times.
[05:02] time dot second right after that we can just say defer cancel then we can just say underscore and error this one goes to redis client bing ctx result
[05:31] F error node equal to new can just say log dot fatal f failed to connect to relays and pass the error. Next we can just say log
[05:59] println connected to release successfully. Okay, next I just press %
[06:28] or we don't need even to add this fatalF we can just directly pass this okay for close redis we can just have a function we can call it close redis
[06:54] All right. Check F. Redis Client. Not equal to 0.08 K, so I can just say Redis. Not close. Sorry, Redis Client.
[07:23] close ok that's pretty yet, we don't know that then we need to move to the end, we can now use it but I just make it simple for us by going and create the models that we are going to use it with redis, we can just say redis.go
[07:52] the package models first one cached will be for cached response and for all posts okay let's just say you have a type we can name it cached
[08:21] get all post response structure or struct data which will be array or
[08:49] Alright, and the JSON for that can be data. We need to call this space one. Next we have current page which will be an integer. And a JSON for that.
[09:18] Next we have number of wages which will be float 64 GSO
[09:47] number of edges okay now just duplicate this what this time will be cached response for user profile
[10:15] okay we can call this getCacheToGetUserResponse all right well actually having first we just came up here and say we have user which would be userModel
[10:44] pointer of json of this user right next to have posts which will be the same thing as we have for data next to have the current page and the number of edges
[11:14] This is actually the same. I think that's good. We can use this. It will be much easier when we use it. And now we just go to the user controller. Before this, remember that we need to add the environment data. Read this connection. We just start by grab this.
[11:42] Redis URL Redis password Okay, Redis URL, we're going to be localhost 6379 Localhost 6379, yeah Any user password?
[12:12] and leave it empty all right next let me just go to the user controller right and here on get user by ID this is the pdm point where we are looking for okay
[12:38] First of all, we start create cache key for user profile and postage. Alright, where we can start doing this. We have no pages, we have user ID. Not sure actually.
[13:07] okay we just start here by saying create cache key for user profile and posts right next we can just
[13:35] the main idea that if we create a cache key that already exists we can search for it so we can just store by say cache key which is going to be fmt sprintf
[14:02] user profile % s and then the page % d
[14:26] and here which can you pass user ID you can just grab this and put that here what did it need to have an object ID page on the second parameter
[14:56] next what we want to do is to check or to try to get from cache first we want to check whether if we already have this or not so we can just came up here and say try to get from cache first from radius meaning
[15:26] checking if we already have this exist or not we can just come up here say cached data cached data and error this one goes to database redis client get passed away the contacts and the cache key
[15:54] and wait for a result f dr equal equal 0 on that case we can just say cache hit so we can return the cache data on that case
[16:18] For that we can just say var cacheResponse or cachedResponse models of cachedGetUserResponse.
[16:47] here we can just use JSON on Marshall for this array of bytes of this cache data and pointer of this cache response I want to check if the error on that case is equal to 0
[17:16] all we can do is to return c.status we can return something exactly like we do here at the end so we can just come up here copy that and paste that here
[17:42] right we need to fix the indentation a little bit all right we already turned this user bot we need to come up and say cached RSP or this RSP cached RS I just call it cachedress or response then came up here say cachedress
[18:10] the user for posts we can say cached res posts for current page and just say cached res current page number of pages we can say cached res number of pages and we want to mark this
[18:40] To allow us to check whether of this cached data or not Just for testing or debugging purposes We can just come up here and say cached This won't make any difference for us Just allow us to check if everything is all fine or not Okay what we have here
[19:09] f this equal to new else and just come up here and say log printf cache miss for user profile present s
[19:38] just copy this and just this will return and all ok this will check if we have it or not so
[20:06] what if this not have we don't have this data on the cache in that case we want operation to keep running but before we return the data after we grab all the data that it need we need to start to add this for caching with TTL all right we just came up here we can just say prepare
[20:35] response for caching. All right, that's cool. Let's just store by saying number of pages, only equal to my seal. You can directly copy this. Next to it, forward coded.
[21:03] We need to stop by defining the create variable that will include the response.
[21:29] getUserResponse will have the user which will be this user will have posts which will be this posts currentPage which will be the page finally number of pages will be this number of pages I think we can directly cut this from here
[21:59] In order to use this data, we need to convert it to slice of bytes to store it on our database.
[22:28] this one goes to jsonMarshall this response and then we can check if error equal equal to 0 on that case we can use it for our database else can just say log printf field toMarshall
[22:57] a response for caching Percent S samples this error. Alright, otherwise here what we can do is to say data bees already inclined, set CTX
[23:25] cached key response json and here we can define the duration we just maved for 10 time dot second right we're cool we just now run our application
[23:51] Are we on the back end? Okay, we need to run what's run 10 as well. Well, before this, let's just go to the code here.
[24:20] on a front end port specifically on a profile this getUser
[24:45] Now we are not looking for this. We click him down here. We do have this data return. .data which is called okay.
[25:14] Alright, I just came up here, below, before this return, say console.log, user, profile, check, already. I am having this data. Okay, cool.
[25:43] to run our application here run self go to our application and then no need to login i'm already logged in not sure whether if i need to log in one more time or not it's on end
[26:11] Now we just use inspect and then console. Now check the backend. Alright, now connection. Okay, let's just go to the profile. Alright, we have an error. Exhaust error.
[26:39] The application is actually cached. We need to fair to our conduct. I think the error is very obvious to me, and the problem is that we forgot to initialize this, what it called, I forgot, this radius in a sense, or the connection.
[27:06] Now we already made, we just came up here and we can come up here and say data or connect to MongoDB database. We can come down here and say
[27:35] call redis and hit connection ok we can just try data base and hit redis and then defer data base close redis
[28:04] clean up on exit so that's pretty it we just now going back run orbit and one more time okay connected to ready successfully cool now just go back here refresh the page okay
[28:33] user profile cached redis just check that out nothing okay now we're going to wait for 10 seconds and refresh this one more time also we can check that out here as you can see this tells us that cache mess for user profile and redis is null
[28:57] alright just wait for 10 seconds and now adjust refresh and see how we will have okay we have this user current alright refresh one more time
[29:26] okay it doesn't look that this returns dot correctly we have what we have closing notification okay let's just go up here
[29:55] go to the profile okay it tells cached nest what if we going back call this one more time still tells cached nest so we didn't adding this successfully just go back to the user controller
[30:21] I think that the issue here is not actually on the backend at all. We just rerun our backend one more time. Everything on the backend is the same and I think we need to go to the user profile on this one.
[30:50] here we do have the response we can just remove here and we can update this to add caching or not so we can do here assembly say console.log store.get
[31:19] user profile check cache and just we can pass this going back rightly just to refresh user check cache here it is as you can see it tells us that cache is true
[31:48] Ok, just going back to the user profile. Take this out. Wait for 10 seconds and refresh the page. Store, as you can see, is still cached. Just wait for 10 seconds. 1, 2, 3, 4, 5, 6.
[32:17] 7, 8, 9, 10 ok just clear this out ok now just go to the profile store check caching as you can see till this cache is true go here go to the profile check as you can see now it is disappeared
[32:43] it is not cached but if you check the backend you will see that this tells us cache mess meaning that this will caching the user data just refresh check this now it's still on cached if we go in here go back check this as you can see tells us cached is true
[33:12] We just totally grab this to make it easy for us to see. So I can just save data. Not cached. Let's save. Now going back. Cache is undefined or refresh. Profile cached is true. It is cached.
[33:42] come up here going back is true but here it is also that this is undefined when both of them became undefined this is mean that this outside of caching operation just wait we can wait for 10 seconds ok now just go back as you can see it's still cached
[34:11] Right, we are here from home. I am back. Caching is true. Unusual controller. This will take TTL by expression duration 10 seconds. Alright.
[34:41] come here going back turns out this is undefined but this actually recall it alright as you can see it's keep working cache messed
[35:06] We can see this on the response. I think that everything works fine. We can now move on to the next and have caching for posts. We just move on to the next lecture.
[35:18] you
